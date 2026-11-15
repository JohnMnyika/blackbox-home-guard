import time
import cv2
import numpy as np
import openvino as ov
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

VIDEO_PATH = PROJECT_DIR / "sample_videos" / "person-test.mp4"
MODEL_PATH = (
    PROJECT_DIR
    / "backend"
    / "models"
    / "person-detection-0202"
    / "FP16"
    / "person-detection-0202.xml"
)

SAMPLE_INTERVAL = 2.0
CONFIDENCE_THRESHOLD = 0.25
INPUT_SIZE = 512


def main():
    if not VIDEO_PATH.exists():
        raise FileNotFoundError(f"Video not found: {VIDEO_PATH}")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    print("\n=== BLACKBOX HOME GUARD: PERSON DETECTION TEST ===")
    print(f"Video: {VIDEO_PATH.name}")
    print(f"Model: {MODEL_PATH.name}")

    # Load and compile the model on the CPU.
    core = ov.Core()
    model = core.read_model(str(MODEL_PATH))
    compiled_model = core.compile_model(model, "CPU")

    input_port = compiled_model.input(0)
    output_port = compiled_model.output(0)

    print("AI model loaded successfully on CPU.")

    # Open the test video.
    cap = cv2.VideoCapture(str(VIDEO_PATH))

    if not cap.isOpened():
        raise RuntimeError("Could not open the test video.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0

    print(f"Resolution: {int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x"
          f"{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"FPS: {fps:.2f}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"Sampling every {SAMPLE_INTERVAL:.0f} seconds")
    print(f"Confidence threshold: {CONFIDENCE_THRESHOLD:.2f}\n")

    detections_total = 0
    frames_with_people = 0
    max_confidence = 0.0
    inference_times = []

    timestamps = np.arange(0, duration, SAMPLE_INTERVAL)

    for timestamp in timestamps:
        cap.set(cv2.CAP_PROP_POS_MSEC, float(timestamp * 1000))
        success, frame = cap.read()

        if not success:
            continue

        # Resize and prepare BGR image as NCHW float32.
        resized = cv2.resize(
            frame,
            (INPUT_SIZE, INPUT_SIZE),
            interpolation=cv2.INTER_LINEAR
        )

        input_tensor = np.expand_dims(
            resized.transpose(2, 0, 1).astype(np.float32),
            axis=0
        )

        start = time.perf_counter()
        result = compiled_model({input_port: input_tensor})
        elapsed = time.perf_counter() - start
        inference_times.append(elapsed)

        predictions = result[output_port].reshape(-1, 7)

        person_scores = []

        for detection in predictions:
            image_id, label, confidence, xmin, ymin, xmax, ymax = detection

            # Ignore unused output rows and non-person classes.
            if image_id < 0 or int(label) != 0:
                continue

            confidence = float(confidence)
            max_confidence = max(max_confidence, confidence)

            if confidence >= CONFIDENCE_THRESHOLD:
                person_scores.append(confidence)

        if person_scores:
            frames_with_people += 1
            detections_total += len(person_scores)

            scores = ", ".join(
                f"{score:.1%}" for score in sorted(person_scores, reverse=True)
            )

            print(
                f"[{timestamp:6.1f}s] PERSON DETECTED: "
                f"{len(person_scores)} | Confidence: {scores}"
            )
        else:
            print(f"[{timestamp:6.1f}s] No person detected")

    cap.release()

    average_inference = (
        sum(inference_times) / len(inference_times)
        if inference_times else 0
    )

    print("\n========== TEST RESULTS ==========")
    print(f"Frames analysed: {len(inference_times)}")
    print(f"Frames with people: {frames_with_people}")
    print(f"Total detections: {detections_total}")
    print(f"Highest person confidence: {max_confidence:.2%}")
    print(f"Average inference time: {average_inference:.3f} seconds")
    print("==================================\n")


if __name__ == "__main__":
    main()
