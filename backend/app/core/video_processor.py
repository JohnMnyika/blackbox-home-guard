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
    """Extract video metadata using FFprobe."""
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

    video_stream = next(
        (
            stream for stream in data.get("streams", [])
            if stream.get("codec_type") == "video"
        ),
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
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "frame_rate": parse_frame_rate(
            video_stream.get("avg_frame_rate")
        ),
        "pixel_format": video_stream.get("pix_fmt"),
        "audio_present": any(
            stream.get("codec_type") == "audio"
            for stream in data.get("streams", [])
        ),
    }


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
