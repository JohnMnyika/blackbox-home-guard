import cv2
import numpy as np
import openvino as ov
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "sample_videos/person-test.mp4"
MODEL = ROOT / "backend/models/person-detection-0202/FP16/person-detection-0202.xml"
OUTPUT = ROOT / "backend/data/ai_debug"
OUTPUT.mkdir(parents=True, exist_ok=True)

THRESHOLD = 0.25
TIMESTAMPS = [0, 30, 58]
SIZE = 512

core = ov.Core()
net = core.compile_model(core.read_model(str(MODEL)), "CPU")
input_port = net.input(0)
output_port = net.output(0)

cap = cv2.VideoCapture(str(VIDEO))

for seconds in TIMESTAMPS:
    cap.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    ok, frame = cap.read()

    if not ok:
        print(f"Could not read frame at {seconds}s")
        continue

    resized = cv2.resize(frame, (SIZE, SIZE))
    tensor = np.expand_dims(
        resized.transpose(2, 0, 1).astype(np.float32), axis=0
    )

    predictions = net({input_port: tensor})[output_port].reshape(-1, 7)

    height, width = frame.shape[:2]
    count = 0

    for row in predictions:
        image_id, label, confidence, xmin, ymin, xmax, ymax = row

        if image_id < 0 or int(label) != 0 or confidence < THRESHOLD:
            continue

        x1 = max(0, min(width - 1, int(xmin * width)))
        y1 = max(0, min(height - 1, int(ymin * height)))
        x2 = max(0, min(width - 1, int(xmax * width)))
        y2 = max(0, min(height - 1, int(ymax * height)))

        if x2 <= x1 or y2 <= y1:
            continue

        count += 1
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            frame, f"Person {confidence:.0%}",
            (x1, max(25, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2
        )

    cv2.putText(
        frame, f"Time: {seconds}s | Detections: {count}",
        (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2
    )

    path = OUTPUT / f"person-detection-{seconds}s.jpg"
    cv2.imwrite(str(path), frame)
    print(f"{path} | detections: {count}")

cap.release()
print("\nPreview images generated successfully.")
