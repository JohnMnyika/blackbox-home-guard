import json
import logging
import shutil
import mimetypes
import re
import sqlite3
import subprocess
import time
import uuid
from typing import Literal
from urllib.parse import urlsplit

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.core.video_processor import (
    ALLOWED_EXTENSIONS,
    calculate_sha256,
    extract_frames,
    probe_video,
    is_browser_compatible,
    create_browser_playback_copy,
)
from app.core.video_analyzer import analyze_video


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
RECORDINGS_DIR = DATA_DIR / "recordings"
DATABASE_PATH = DATA_DIR / "blackbox.db"

MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
logger = logging.getLogger("blackbox.homeguard")

DATA_DIR.mkdir(parents=True, exist_ok=True)
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


class CameraConfiguration(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=500)
    camera_type: Literal["rtsp", "usb"]

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Camera name cannot be blank.")
        return value

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        value = value.strip()
        if value.startswith("/dev/video") and re.fullmatch(r"/dev/video\d+", value):
            return value
        if value.isdigit():
            return value
        parsed = urlsplit(value)
        if parsed.scheme in {"rtsp", "rtsps"} and parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment:
            return value
        raise ValueError("Use an RTSP URL without embedded credentials or a local camera device such as /dev/video0.")


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS system_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL
            )
        """)

        connection.execute("""
            INSERT OR IGNORE INTO system_metadata (key, value)
            VALUES ('schema_version', '2')
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS recordings (
                id TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                duration REAL,
                width INTEGER,
                height INTEGER,
                frame_rate REAL,
                video_codec TEXT,
                format_name TEXT,
                frame_count INTEGER DEFAULT 0,
                metadata_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # Additive migration: preserve every existing recording and column.
        existing_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(recordings)")
        }

        new_columns = {
            "playback_path": "TEXT",
            "playback_size": "INTEGER",
            "playback_sha256": "TEXT",
            "playback_codec": "TEXT",
            "playback_format": "TEXT",
            "playback_status": "TEXT NOT NULL DEFAULT 'original'",
        }

        for column, definition in new_columns.items():
            if column not in existing_columns:
                connection.execute(
                    f"ALTER TABLE recordings ADD COLUMN {column} {definition}"
                )

        # AI detection events: schema version 4.
        connection.execute("""
            CREATE TABLE IF NOT EXISTS detection_events (
                id TEXT PRIMARY KEY,
                analysis_id TEXT NOT NULL,
                recording_id TEXT NOT NULL,
                detection_type TEXT NOT NULL,
                timestamp_seconds REAL NOT NULL,
                confidence REAL NOT NULL,
                bbox_x INTEGER NOT NULL,
                bbox_y INTEGER NOT NULL,
                bbox_width INTEGER NOT NULL,
                bbox_height INTEGER NOT NULL,
                evidence_image_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (recording_id)
                    REFERENCES recordings(id)
                    ON DELETE CASCADE
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT NOT NULL,
                camera_type TEXT NOT NULL CHECK (camera_type IN ('rtsp', 'usb')),
                connection_status TEXT NOT NULL DEFAULT 'not tested',
                created_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_detection_recording_time
            ON detection_events(recording_id, timestamp_seconds)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_detection_analysis
            ON detection_events(analysis_id)
        """)

        connection.execute("""
            UPDATE system_metadata
            SET value = '4'
            WHERE key = 'schema_version'
        """)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="BlackBox Home Guard API",
    description="Local-first AI surveillance intelligence platform",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
def root():
    return {
        "name": "BlackBox Home Guard",
        "version": "0.2.0",
        "message": "Local surveillance intelligence API is running",
    }


@app.get("/api/v1/health")
def health():
    try:
        with get_connection() as connection:
            connection.execute("SELECT 1")
        database_status = "connected"
    except sqlite3.Error:
        database_status = "disconnected"

    model_available = (BASE_DIR / "models" / "person-detection-0202" / "FP16" / "person-detection-0202.xml").is_file()
    video_available = shutil.which("ffprobe") is not None and shutil.which("ffmpeg") is not None
    operational = database_status == "connected" and model_available and video_available
    return {
        "status": "healthy" if operational else "degraded",
        "application": "BlackBox Home Guard",
        "version": "0.2.0",
        "database": database_status,
        "ai_engine": "available" if model_available else "not_configured",
        "video_engine": "available" if video_available else "offline",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "privacy": {
            "processing_mode": "local",
            "cloud_ai_required": False,
        },
    }


@app.get("/api/v1/system/info")
def system_info():
    model_path = BASE_DIR / "models" / "person-detection-0202" / "FP16" / "person-detection-0202.xml"
    try:
        import openvino
        ai_engine = "OpenVINO CPU" if model_path.is_file() else "Not configured"
        model_status = "person-detection-0202 FP16" if model_path.is_file() else "Model unavailable"
    except ImportError:
        ai_engine = "Not configured"
        model_status = "OpenVINO unavailable"
    try:
        subprocess.run(["ffprobe", "-version"], capture_output=True, timeout=3, check=True)
        video_engine = "FFmpeg / FFprobe"
    except (OSError, subprocess.SubprocessError):
        video_engine = "Unavailable"
    usage = shutil.disk_usage(DATA_DIR)
    with get_connection() as connection:
        camera_count = connection.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    return {
        "application": "BlackBox Home Guard",
        "version": app.version,
        "environment": "local",
        "video_engine": video_engine,
        "ai_engine": ai_engine,
        "model": model_status,
        "storage_engine": "SQLite",
        "processing_mode": "local",
        "cameras": f"{camera_count} configured; not tested" if camera_count else "Not configured",
        "storage": {"used_bytes": sum(p.stat().st_size for p in RECORDINGS_DIR.rglob("*") if p.is_file()), "free_bytes": usage.free},
    }


@app.get("/api/v1/dashboard")
def dashboard_summary():
    """Return operational counters and recent real records."""
    with get_connection() as connection:
        recordings_count = connection.execute("SELECT COUNT(*) FROM recordings").fetchone()[0]
        processed_count = connection.execute("SELECT COUNT(*) FROM recordings WHERE status = 'processed'").fetchone()[0]
        detection_count = connection.execute("SELECT COUNT(*) FROM detection_events").fetchone()[0]
        evidence_count = connection.execute("SELECT COUNT(DISTINCT evidence_image_path) FROM detection_events").fetchone()[0]
        camera_count = connection.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
        recent_recordings = connection.execute("SELECT id, original_filename, file_size, status, created_at FROM recordings ORDER BY created_at DESC LIMIT 5").fetchall()
        recent_detections = connection.execute("""
            SELECT d.id, d.recording_id, d.analysis_id, d.detection_type, d.timestamp_seconds,
                   d.confidence, r.original_filename
            FROM detection_events d JOIN recordings r ON r.id = d.recording_id
            ORDER BY d.created_at DESC, d.timestamp_seconds DESC LIMIT 8
        """).fetchall()
    return {"recordings": recordings_count, "processed_recordings": processed_count,
            "detections": detection_count, "evidence_images": evidence_count,
            "cameras": camera_count, "recent_recordings": [dict(row) for row in recent_recordings],
            "recent_detections": [dict(row) for row in recent_detections]}


@app.get("/api/v1/cameras")
def list_camera_configurations():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT id, name, source, camera_type, connection_status, created_at
            FROM cameras ORDER BY created_at DESC
        """).fetchall()
    return {"total": len(rows), "cameras": [dict(row) for row in rows]}


@app.post("/api/v1/cameras", status_code=201)
def create_camera_configuration(configuration: CameraConfiguration):
    camera_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO cameras (id, name, source, camera_type, connection_status, created_at)
            VALUES (?, ?, ?, ?, 'not tested', ?)
        """, (camera_id, configuration.name, configuration.source, configuration.camera_type, created_at))
    return {"id": camera_id, "name": configuration.name, "source": configuration.source,
            "camera_type": configuration.camera_type, "connection_status": "not tested",
            "created_at": created_at}


@app.get("/api/v1/detections")
def list_detections(limit: int = 100, offset: int = 0):
    if not 1 <= limit <= 500 or offset < 0:
        raise HTTPException(status_code=400, detail="Limit must be 1–500 and offset non-negative.")
    with get_connection() as connection:
        total = connection.execute("SELECT COUNT(*) FROM detection_events").fetchone()[0]
        rows = connection.execute("""
            SELECT d.id, d.analysis_id, d.recording_id, d.detection_type, d.timestamp_seconds,
                   d.confidence, d.created_at, r.original_filename
            FROM detection_events d JOIN recordings r ON r.id = d.recording_id
            ORDER BY d.created_at DESC, d.timestamp_seconds DESC LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()
    detections = []
    for row in rows:
        item = dict(row)
        item["evidence_url"] = f"/api/v1/recordings/{item['recording_id']}/detections/{item['id']}/evidence"
        detections.append(item)
    return {"total": total, "detections": detections}


@app.post("/api/v1/recordings")
async def upload_recording(file: UploadFile = File(...)):
    original_filename = Path(file.filename or "recording").name
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video extension.",
        )

    recording_id = str(uuid.uuid4())
    recording_directory = RECORDINGS_DIR / recording_id
    recording_directory.mkdir(parents=True, exist_ok=False)

    stored_filename = f"original{extension}"
    video_path = recording_directory / stored_filename
    frames_directory = recording_directory / "frames"

    total_size = 0

    try:
        with video_path.open("wb") as destination:
            while chunk := await file.read(CHUNK_SIZE):
                total_size += len(chunk)

                if total_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Video exceeds the 2 GB upload limit.",
                    )

                destination.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded video is empty.",
            )

        sha256 = calculate_sha256(video_path)

        try:
            metadata = probe_video(video_path)
        except (
            subprocess.SubprocessError,
            json.JSONDecodeError,
            ValueError,
            OSError,
        ) as error:
            raise HTTPException(
                status_code=422,
                detail="The uploaded file is not a valid supported video or could not be decoded.",
            ) from error

        # Keep original evidence untouched. Create a separate browser copy
        # only when the source is not a supported MP4/H.264 combination.
        playback_path = None
        playback_size = None
        playback_sha256 = None
        playback_codec = None
        playback_format = None
        playback_status = "original"

        if not is_browser_compatible(metadata):
            candidate_path = recording_directory / "playback.mp4"

            try:
                playback = create_browser_playback_copy(
                    video_path,
                    candidate_path,
                )
                playback_path = str(playback["path"])
                playback_size = playback["size"]
                playback_sha256 = playback["sha256"]
                playback_codec = playback["metadata"]["video_codec"]
                playback_format = playback["metadata"]["format_name"]
                playback_status = "converted"
            except Exception as conversion_error:
                # Preserve the successful original import even if conversion fails.
                playback_status = "failed"
                logger.warning("Playback conversion failed for recording %s: %s", recording_id, conversion_error)

        frames = extract_frames(
            video_path,
            frames_directory,
            interval_seconds=10,
        )

        created_at = datetime.now(timezone.utc).isoformat()

        with get_connection() as connection:
            connection.execute("""
                INSERT INTO recordings (
                    id,
                    original_filename,
                    stored_filename,
                    file_path,
                    file_size,
                    sha256,
                    duration,
                    width,
                    height,
                    frame_rate,
                    video_codec,
                    format_name,
                    frame_count,
                    metadata_json,
                    status,
                    created_at,
                    playback_path,
                    playback_size,
                    playback_sha256,
                    playback_codec,
                    playback_format,
                    playback_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                recording_id,
                original_filename,
                stored_filename,
                str(video_path),
                total_size,
                sha256,
                metadata["duration"],
                metadata["width"],
                metadata["height"],
                metadata["frame_rate"],
                metadata["video_codec"],
                metadata["format_name"],
                len(frames),
                json.dumps(metadata),
                "processed",
                created_at,
                playback_path,
                playback_size,
                playback_sha256,
                playback_codec,
                playback_format,
                playback_status,
            ))

        return {
            "message": "Recording successfully imported.",
            "recording_id": recording_id,
            "filename": original_filename,
            "file_size": total_size,
            "sha256": sha256,
            "metadata": metadata,
            "frame_count": len(frames),
            "frames": [
                f"/api/v1/recordings/{recording_id}/frames/{name}"
                for name in frames
            ],
            "status": "processed",
            "created_at": created_at,
            "playback_status": playback_status,
            "playback_codec": playback_codec,
            "playback_format": playback_format,
            "playback_size": playback_size,
        }

    except HTTPException:
        import shutil
        shutil.rmtree(recording_directory, ignore_errors=True)
        raise

    except Exception as error:
        import shutil
        shutil.rmtree(recording_directory, ignore_errors=True)
        logger.exception("Recording processing failed for %s", recording_id)
        raise HTTPException(
            status_code=500,
            detail="Recording processing failed. Check the backend log for details.",
        ) from error

    finally:
        await file.close()


@app.get("/api/v1/recordings")
def list_recordings():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                id, original_filename, file_size, sha256,
                duration, width, height, frame_rate,
                video_codec, frame_count, status, created_at,
                playback_status, playback_codec, playback_format, playback_size
            FROM recordings
            ORDER BY created_at DESC
        """).fetchall()

    detections = []
    for row in rows:
        item = dict(row)
        item.pop("evidence_image_path", None)
        item["evidence_url"] = f"/api/v1/recordings/{recording_id}/detections/{item['id']}/evidence"
        detections.append(item)
    return {
        "total": len(rows),
        "recordings": [dict(row) for row in rows],
    }


@app.get("/api/v1/recordings/{recording_id}")
def get_recording(recording_id: str):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT
                id, original_filename, file_size, sha256,
                duration, width, height, frame_rate,
                video_codec, format_name, frame_count,
                metadata_json, status, created_at,
                playback_size, playback_sha256,
                playback_codec, playback_format, playback_status
            FROM recordings
            WHERE id = ?
        """, (recording_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found.")

    result = dict(row)
    result["metadata"] = json.loads(result.pop("metadata_json"))

    return result




@app.get("/api/v1/recordings/{recording_id}/video")
def play_recording_video(recording_id: str, request: Request):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT
                file_path, file_size, original_filename, sha256,
                playback_path, playback_size, playback_sha256
            FROM recordings
            WHERE id = ?
        """, (recording_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found.")

    # Use the compatible copy when one exists; otherwise fall back to original.
    use_playback_copy = bool(row["playback_path"])
    selected_path = row["playback_path"] if use_playback_copy else row["file_path"]
    expected_size = row["playback_size"] if use_playback_copy else row["file_size"]
    expected_hash = row["playback_sha256"] if use_playback_copy else row["sha256"]

    try:
        video_path = Path(selected_path).resolve(strict=True)
        recordings_root = RECORDINGS_DIR.resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Video file not found.")

    if not video_path.is_relative_to(recordings_root):
        raise HTTPException(status_code=403, detail="Invalid video storage path.")

    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found.")

    file_size = video_path.stat().st_size

    if file_size != expected_size:
        raise HTTPException(
            status_code=409,
            detail="Stored video size differs from its recorded metadata."
        )

    if file_size <= 0:
        raise HTTPException(status_code=404, detail="Video file is empty.")

    media_type = (
        "video/mp4"
        if use_playback_copy
        else mimetypes.guess_type(row["original_filename"])[0]
    ) or "application/octet-stream"

    range_header = request.headers.get("range")
    start = 0
    end = file_size - 1
    status_code = 200

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": media_type,
        "Cache-Control": "private, no-store",
        "ETag": f'"{expected_hash}"',
        "X-Content-Type-Options": "nosniff",
        "X-Playback-Source": "converted-copy" if use_playback_copy else "original",
    }

    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())

        if not match:
            raise HTTPException(
                status_code=416,
                detail="Invalid or unsupported byte range.",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        first, last = match.groups()

        if not first and not last:
            raise HTTPException(
                status_code=416,
                detail="Invalid byte range.",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        if not first:
            suffix_length = int(last)
            if suffix_length <= 0:
                raise HTTPException(
                    status_code=416,
                    detail="Invalid byte range.",
                    headers={"Content-Range": f"bytes */{file_size}"},
                )
            start = max(0, file_size - suffix_length)
        else:
            start = int(first)
            if last:
                end = int(last)

        if start >= file_size or end < start:
            raise HTTPException(
                status_code=416,
                detail="Requested byte range is not satisfiable.",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        end = min(end, file_size - 1)
        status_code = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        headers["Content-Length"] = str(end - start + 1)

    def stream_video():
        remaining = end - start + 1

        with video_path.open("rb") as video:
            video.seek(start)

            while remaining > 0:
                chunk = video.read(min(1024 * 1024, remaining))

                if not chunk:
                    break

                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        stream_video(),
        status_code=status_code,
        media_type=media_type,
        headers=headers,
    )


@app.get("/api/v1/recordings/{recording_id}/frames")
def list_recording_frames(recording_id: str):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT id FROM recordings WHERE id = ?
        """, (recording_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found.")

    frames_directory = RECORDINGS_DIR / recording_id / "frames"

    frames = sorted(
        path.name for path in frames_directory.glob("frame_*.jpg")
    )

    return {
        "recording_id": recording_id,
        "total": len(frames),
        "frames": [
            f"/api/v1/recordings/{recording_id}/frames/{name}"
            for name in frames
        ],
    }


@app.get("/api/v1/recordings/{recording_id}/frames/{filename}")
def get_recording_frame(recording_id: str, filename: str):
    if not re.fullmatch(r"frame_\d{6}\.jpg", filename):
        raise HTTPException(
            status_code=400,
            detail="Invalid frame filename.",
        )

    with get_connection() as connection:
        row = connection.execute("""
            SELECT id FROM recordings WHERE id = ?
        """, (recording_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found.")

    frame_path = RECORDINGS_DIR / recording_id / "frames" / filename

    if not frame_path.is_file():
        raise HTTPException(status_code=404, detail="Frame not found.")

    return FileResponse(frame_path, media_type="image/jpeg")


# ============================================================
# AI VIDEO ANALYSIS AND DETECTION API
# ============================================================

@app.post("/api/v1/recordings/{recording_id}/analyze")
def analyze_recording(
    recording_id: str,
    interval_seconds: float = 2.0,
):
    """
    Analyze an uploaded recording using local OpenVINO detection.
    Each analysis receives a unique ID and evidence directory.
    """

    if not 0.25 <= interval_seconds <= 60:
        raise HTTPException(
            status_code=400,
            detail="Analysis interval must be between 0.25 and 60 seconds.",
        )

    with get_connection() as connection:
        recording = connection.execute("""
            SELECT id, file_path, original_filename, status
            FROM recordings
            WHERE id = ?
        """, (recording_id,)).fetchone()

    if not recording:
        raise HTTPException(
            status_code=404,
            detail="Recording not found.",
        )

    recording_directory = (RECORDINGS_DIR / recording_id).resolve()

    try:
        video_path = Path(recording["file_path"]).resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(
            status_code=404,
            detail="Original recording file not found.",
        )

    if (
        not video_path.is_file()
        or not video_path.is_relative_to(recording_directory)
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid recording storage path.",
        )

    analysis_id = str(uuid.uuid4())
    evidence_directory = (
        recording_directory / "detections" / analysis_id
    )

    started_at = time.perf_counter()

    try:
        result = analyze_video(
            video_path=video_path,
            evidence_directory=evidence_directory,
            interval_seconds=interval_seconds,
        )

        completed_at = datetime.now(timezone.utc).isoformat()
        processing_seconds = round(
            time.perf_counter() - started_at, 3
        )

        events = result["events"]

        # Persist the complete analysis result in one transaction.
        with get_connection() as connection:
            for event in events:
                bbox = event["bbox"]

                connection.execute("""
                    INSERT INTO detection_events (
                        id,
                        analysis_id,
                        recording_id,
                        detection_type,
                        timestamp_seconds,
                        confidence,
                        bbox_x,
                        bbox_y,
                        bbox_width,
                        bbox_height,
                        evidence_image_path,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    analysis_id,
                    recording_id,
                    event["detection_type"],
                    event["timestamp_seconds"],
                    event["confidence"],
                    bbox["x"],
                    bbox["y"],
                    bbox["width"],
                    bbox["height"],
                    event["evidence_image_path"],
                    completed_at,
                ))

        return {
            "message": "Video analysis completed successfully.",
            "analysis_id": analysis_id,
            "recording_id": recording_id,
            "filename": recording["original_filename"],
            "status": "completed",
            "interval_seconds": result["interval_seconds"],
            "duration_seconds": result["duration_seconds"],
            "analyzed_frames": result["analyzed_frames"],
            "total_detections": result["total_detections"],
            "processing_seconds": processing_seconds,
            "completed_at": completed_at,
        }

    except HTTPException:
        raise

    except Exception as error:
        logger.exception("Video analysis failed for recording %s", recording_id)
        raise HTTPException(
            status_code=500,
            detail="Video analysis failed. Check the backend log for details.",
        ) from error


@app.get("/api/v1/recordings/{recording_id}/detections")
def get_recording_detections(
    recording_id: str,
    analysis_id: str | None = None,
):
    """Retrieve detection events for a recording."""

    with get_connection() as connection:
        recording = connection.execute(
            "SELECT id FROM recordings WHERE id = ?",
            (recording_id,),
        ).fetchone()

        if not recording:
            raise HTTPException(
                status_code=404,
                detail="Recording not found.",
            )

        if analysis_id:
            rows = connection.execute("""
                SELECT *
                FROM detection_events
                WHERE recording_id = ? AND analysis_id = ?
                ORDER BY timestamp_seconds ASC
            """, (recording_id, analysis_id)).fetchall()
        else:
            rows = connection.execute("""
                SELECT *
                FROM detection_events
                WHERE recording_id = ?
                ORDER BY timestamp_seconds ASC
            """, (recording_id,)).fetchall()

    detections = []
    for row in rows:
        item = dict(row)
        item.pop("evidence_image_path", None)
        item["evidence_url"] = f"/api/v1/recordings/{recording_id}/detections/{item['id']}/evidence"
        detections.append(item)
    return {
        "recording_id": recording_id,
        "analysis_id": analysis_id,
        "total": len(rows),
        "detections": detections,
    }


@app.get(
    "/api/v1/recordings/{recording_id}/detections/"
    "{event_id}/evidence"
)
def get_detection_evidence(
    recording_id: str,
    event_id: str,
):
    """Serve an annotated detection evidence image safely."""

    with get_connection() as connection:
        row = connection.execute("""
            SELECT evidence_image_path
            FROM detection_events
            WHERE recording_id = ? AND id = ?
        """, (recording_id, event_id)).fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Detection event not found.",
        )

    recording_directory = (
        RECORDINGS_DIR / recording_id
    ).resolve()

    try:
        evidence_path = Path(
            row["evidence_image_path"]
        ).resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(
            status_code=404,
            detail="Evidence image not found.",
        )

    if (
        not evidence_path.is_file()
        or evidence_path.suffix.lower() not in {".jpg", ".jpeg"}
        or not evidence_path.is_relative_to(recording_directory)
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid evidence image path.",
        )

    return FileResponse(
        evidence_path,
        media_type="image/jpeg",
    )
