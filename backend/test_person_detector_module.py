import time
import cv2
from pathlib import Path
from app.core.person_detector import get_person_detector

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "sample_videos" / "person-test.mp4"
INTERVAL = 2.0

def main():
    detector = get_person_detector()
    cap = cv2.VideoCapture(str(VIDEO))

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {VIDEO}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    results = []
    inference_times = []

    print("\n=== BLACKBOX PERSON DETECTOR TEST ===")
    print(f"Video duration: {duration:.2f}s")
    print("Device: CPU")
    print(f"Sampling interval: {INTERVAL}s\n")

    timestamp = 0.0

    while timestamp < duration:
        cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
        success, frame = cap.read()

        if not success:
            break

        start = time.perf_counter()
        detections = detector.detect(frame)
        elapsed = time.perf_counter() - start

        inference_times.append(elapsed)
        results.append((timestamp, detections))

        if detections:
            scores = ", ".join(
                f"{item['confidence']:.1%}" for item in detections
            )
            print(
                f"[{timestamp:5.1f}s] "
                f"{len(detections)} people | {scores}"
            )
        else:
            print(f"[{timestamp:5.1f}s] No people detected")

        timestamp += INTERVAL

    cap.release()

    detected_frames = sum(bool(items) for _, items in results)
    total_detections = sum(len(items) for _, items in results)
    average_time = (
        sum(inference_times) / len(inference_times)
        if inference_times else 0
    )

    print("\n========== SUMMARY ==========")
    print(f"Frames analysed: {len(results)}")
    print(f"Frames with people: {detected_frames}")
    print(f"Total detections after NMS: {total_detections}")
    print(f"Average inference: {average_time:.4f}s")
    print("=============================\n")

if __name__ == "__main__":
    main()
