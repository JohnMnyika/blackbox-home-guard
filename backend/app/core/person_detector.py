from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import openvino as ov


BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "person-detection-0202"
    / "FP16"
    / "person-detection-0202.xml"
)

CONFIDENCE_THRESHOLD = 0.25
NMS_THRESHOLD = 0.45


class PersonDetector:
    """Local person detection using OpenVINO."""

    def __init__(self):
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(
                f"Person detection model not found: {MODEL_PATH}"
            )

        self.core = ov.Core()
        self.model = self.core.read_model(str(MODEL_PATH))
        self.compiled_model = self.core.compile_model(
            self.model, "CPU"
        )

        self.input_port = self.compiled_model.input(0)
        self.output_port = self.compiled_model.output(0)

        input_shape = self.input_port.shape
        self.input_height = int(input_shape[2])
        self.input_width = int(input_shape[3])

        self.lock = Lock()

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Detect people in a BGR OpenCV frame.

        Returns pixel-based bounding boxes and confidence scores.
        """

        if frame is None or frame.size == 0:
            raise ValueError("Invalid video frame.")

        original_height, original_width = frame.shape[:2]

        resized = cv2.resize(
            frame,
            (self.input_width, self.input_height),
            interpolation=cv2.INTER_LINEAR,
        )

        input_tensor = np.expand_dims(
            resized.transpose(2, 0, 1).astype(np.float32),
            axis=0,
        )

        with self.lock:
            result = self.compiled_model({
                self.input_port: input_tensor
            })

        predictions = result[self.output_port].reshape(-1, 7)

        boxes = []
        scores = []

        for detection in predictions:
            image_id, label, confidence, xmin, ymin, xmax, ymax = detection

            if image_id < 0 or int(label) != 0:
                continue

            confidence = float(confidence)

            if confidence < CONFIDENCE_THRESHOLD:
                continue

            x1 = max(
                0,
                min(original_width - 1, int(xmin * original_width))
            )
            y1 = max(
                0,
                min(original_height - 1, int(ymin * original_height))
            )
            x2 = max(
                0,
                min(original_width, int(xmax * original_width))
            )
            y2 = max(
                0,
                min(original_height, int(ymax * original_height))
            )

            if x2 <= x1 or y2 <= y1:
                continue

            boxes.append([
                x1,
                y1,
                x2 - x1,
                y2 - y1,
            ])
            scores.append(confidence)

        if not boxes:
            return []

        selected = cv2.dnn.NMSBoxes(
            boxes,
            scores,
            CONFIDENCE_THRESHOLD,
            NMS_THRESHOLD,
        )

        if len(selected) == 0:
            return []

        detections = []

        for index in np.asarray(selected).flatten():
            x, y, width, height = boxes[int(index)]

            detections.append({
                "label": "person",
                "confidence": round(scores[int(index)], 4),
                "bbox": {
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                },
            })

        return detections


_detector = None
_detector_lock = Lock()


def get_person_detector() -> PersonDetector:
    """Initialize the detector once and reuse it."""

    global _detector

    with _detector_lock:
        if _detector is None:
            _detector = PersonDetector()

    return _detector
