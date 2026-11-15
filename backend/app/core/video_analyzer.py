import cv2
import json

from pathlib import Path
from datetime import datetime, timezone

from app.core.person_detector import get_person_detector


def analyze_video(
    video_path: Path,
    evidence_directory: Path,
    interval_seconds: float = 2.0,
) -> dict:
    if not video_path.is_file():
        raise FileNotFoundError(f"Video not found: {video_path}")

    if interval_seconds <= 0:
        raise ValueError("Analysis interval must be greater than zero.")

    evidence_directory.mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(video_path))

    if not capture.isOpened():
        raise ValueError("Unable to open video for analysis.")

    fps = capture.get(cv2.CAP_PROP_FPS)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

    if fps <= 0 or frame_count <= 0:
        capture.release()
        raise ValueError("Video has invalid frame metadata.")

    duration = frame_count / fps
    frame_interval = max(1, int(round(fps * interval_seconds)))

    detector = get_person_detector()

    events = []
    analyzed_frames = 0
    frame_index = 0

    try:
        while frame_index < frame_count:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)

            success, frame = capture.read()

            if not success:
                break

            analyzed_frames += 1
            timestamp_seconds = frame_index / fps

            detections = detector.detect(frame)

            if detections:
                annotated = frame.copy()

                for detection in detections:
                    bbox = detection["bbox"]

                    x = bbox["x"]
                    y = bbox["y"]
                    width = bbox["width"]
                    height = bbox["height"]
                    confidence = detection["confidence"]

                    cv2.rectangle(
                        annotated,
                        (x, y),
                        (x + width, y + height),
                        (0, 255, 0),
                        2,
                    )

                    cv2.putText(
                        annotated,
                        f"Person {confidence:.2f}",
                        (x, max(20, y - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 255, 0),
                        2,
                    )

                    events.append({
                        "detection_type": "person",
                        "timestamp_seconds": round(timestamp_seconds, 3),
                        "confidence": confidence,
                        "bbox": bbox,
                    })

                filename = f"detection_{frame_index:010d}.jpg"
                evidence_path = evidence_directory / filename

                if not cv2.imwrite(str(evidence_path), annotated):
                    raise RuntimeError(
                        f"Unable to save evidence image: {evidence_path}"
                    )

                # Every detection from this sampled frame references
                # the same annotated evidence image.
                for event in events[-len(detections):]:
                    event["evidence_image_path"] = str(evidence_path)

            frame_index += frame_interval

    finally:
        capture.release()

    return {
        "duration_seconds": round(duration, 3),
        "interval_seconds": interval_seconds,
        "analyzed_frames": analyzed_frames,
        "total_detections": len(events),
        "events": events,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
