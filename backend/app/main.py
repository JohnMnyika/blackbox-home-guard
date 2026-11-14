import json
import mimetypes
import re
import sqlite3
import subprocess
import uuid

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from app.core.video_processor import (
    ALLOWED_EXTENSIONS,
    calculate_sha256,
    extract_frames,
    probe_video,
)


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
RECORDINGS_DIR = DATA_DIR / "recordings"
DATABASE_PATH = DATA_DIR / "blackbox.db"

MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

DATA_DIR.mkdir(parents=True, exist_ok=True)
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


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

    return {
        "status": "healthy" if database_status == "connected" else "degraded",
        "application": "BlackBox Home Guard",
        "version": "0.2.0",
        "database": database_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "privacy": {
            "processing_mode": "local",
            "cloud_ai_required": False,
        },
    }


@app.get("/api/v1/system/info")
def system_info():
    return {
        "application": "BlackBox Home Guard",
        "environment": "development",
        "video_engine": "FFmpeg / FFprobe",
        "ai_engine": "pending",
        "storage_engine": "SQLite",
        "deployment_target": "UGREEN NAS / Linux",
    }


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
                detail=f"Video validation failed: {error}",
            ) from error

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
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        }

    except HTTPException:
        import shutil
        shutil.rmtree(recording_directory, ignore_errors=True)
        raise

    except Exception as error:
        import shutil
        shutil.rmtree(recording_directory, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Recording processing failed: {error}",
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
                video_codec, frame_count, status, created_at
            FROM recordings
            ORDER BY created_at DESC
        """).fetchall()

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
                metadata_json, status, created_at
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
            SELECT file_path, file_size, original_filename, sha256
            FROM recordings
            WHERE id = ?
        """, (recording_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found.")

    try:
        video_path = Path(row["file_path"]).resolve(strict=True)
        recordings_root = RECORDINGS_DIR.resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Video file not found.")

    if not video_path.is_relative_to(recordings_root):
        raise HTTPException(status_code=403, detail="Invalid video storage path.")

    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found.")

    file_size = video_path.stat().st_size

    if file_size != row["file_size"]:
        raise HTTPException(
            status_code=409,
            detail="Stored video size differs from the recorded evidence metadata."
        )

    if file_size <= 0:
        raise HTTPException(status_code=404, detail="Video file is empty.")

    media_type = (
        mimetypes.guess_type(row["original_filename"])[0]
        or "application/octet-stream"
    )

    range_header = request.headers.get("range")
    start = 0
    end = file_size - 1
    status_code = 200

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": media_type,
        "Cache-Control": "private, no-store",
        "ETag": f'"{row["sha256"]}"',
        "X-Content-Type-Options": "nosniff",
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
