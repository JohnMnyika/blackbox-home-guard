import hashlib
import json
import subprocess
from pathlib import Path


FFPROBE = "ffprobe"
FFMPEG = "ffmpeg"

ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".avi",
    ".webm", ".m4v", ".mpeg", ".mpg"
}


def calculate_sha256(file_path: Path) -> str:
    """Calculate SHA-256 without loading the whole video into memory."""
    digest = hashlib.sha256()

    with file_path.open("rb") as video:
        while chunk := video.read(1024 * 1024):
            digest.update(chunk)

    return digest.hexdigest()


def probe_video(file_path: Path) -> dict:
    """Extract video and audio metadata using FFprobe."""
    command = [
        FFPROBE,
        "-v", "error",
        "-show_format",
        "-show_streams",
        "-of", "json",
        str(file_path),
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )

    data = json.loads(result.stdout)

    streams = data.get("streams", [])
    video_stream = next(
        (stream for stream in streams if stream.get("codec_type") == "video"),
        None,
    )
    audio_stream = next(
        (stream for stream in streams if stream.get("codec_type") == "audio"),
        None,
    )

    if not video_stream:
        raise ValueError("No video stream was found in this file.")

    format_info = data.get("format", {})

    def parse_frame_rate(value):
        try:
            numerator, denominator = value.split("/")
            denominator = float(denominator)
            return round(float(numerator) / denominator, 3) if denominator else 0
        except (ValueError, AttributeError, ZeroDivisionError):
            return None

    return {
        "duration": float(format_info.get("duration", 0)),
        "format_name": format_info.get("format_name"),
        "file_size": int(format_info.get("size", file_path.stat().st_size)),
        "video_codec": video_stream.get("codec_name"),
        "video_profile": video_stream.get("profile"),
        "video_level": video_stream.get("level"),
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "frame_rate": parse_frame_rate(video_stream.get("avg_frame_rate")),
        "pixel_format": video_stream.get("pix_fmt"),
        "audio_present": audio_stream is not None,
        "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
    }


def is_browser_compatible(metadata: dict) -> bool:
    """Conservatively identify common browser-playable MP4/H.264 footage."""
    formats = (metadata.get("format_name") or "").lower().split(",")
    mp4_container = any(
        item in {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"}
        for item in formats
    )

    return (
        mp4_container
        and metadata.get("video_codec") == "h264"
        and metadata.get("pixel_format") == "yuv420p"
        and (
            not metadata.get("audio_present")
            or metadata.get("audio_codec") == "aac"
        )
    )


def create_browser_playback_copy(
    source_path: Path,
    output_path: Path,
) -> dict:
    """
    Create a separate H.264/AAC MP4 playback copy.
    The source evidence file is never modified.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        FFMPEG,
        "-hide_banner",
        "-loglevel", "error",
        "-i", str(source_path),
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-map_metadata", "0",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-threads", "2",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-y",
        str(output_path),
    ]

    try:
        subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=7200,
            check=True,
        )

        if not output_path.is_file() or output_path.stat().st_size <= 0:
            raise RuntimeError("FFmpeg did not produce a valid playback file.")

        playback_metadata = probe_video(output_path)

        if not is_browser_compatible(playback_metadata):
            raise RuntimeError(
                "Generated playback copy did not pass browser compatibility checks."
            )

        return {
            "path": output_path,
            "size": output_path.stat().st_size,
            "sha256": calculate_sha256(output_path),
            "metadata": playback_metadata,
        }

    except Exception:
        output_path.unlink(missing_ok=True)
        raise


def extract_frames(
    file_path: Path,
    output_directory: Path,
    interval_seconds: int = 10,
) -> list[str]:
    """Extract one representative frame every N seconds."""
    output_directory.mkdir(parents=True, exist_ok=True)

    output_pattern = output_directory / "frame_%06d.jpg"

    command = [
        FFMPEG,
        "-hide_banner",
        "-loglevel", "error",
        "-i", str(file_path),
        "-vf", f"fps=1/{interval_seconds},scale='min(960,iw)':-2",
        "-q:v", "3",
        "-y",
        str(output_pattern),
    ]

    subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=600,
        check=True,
    )

    return sorted(
        path.name for path in output_directory.glob("frame_*.jpg")
    )
