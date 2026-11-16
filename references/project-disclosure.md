# Project Disclosures

## Principal functionality developed

Blackbox Home Guard is a privacy-oriented video recording management and analysis prototype. Its standalone application supports local video uploads, video metadata and frame extraction, SHA-256 fingerprints, sampled person detection using OpenVINO, detection records, annotated evidence images, and a web interface for reviewing recordings and detections.

The hackathon Skill adds a distinct UGREEN NAS workflow: it queries authorized surveillance events for a user-confirmed time range, retrieves available event evidence, and prepares an evidence-linked chronological summary.

The Skill does not install or run the standalone application on UGREEN NAS. It does not perform live camera capture, direct video inference, face identification, or vehicle-plate identification.

## UGREEN capabilities

The Skill delegates surveillance work to the UGREEN-registered `security-monitor-agent` and uses the `ug-surveillance` capability. The actions used are `cameras`, `event-timeline`, and `event-evidence`.

The parent Skill does not execute NAS CLI commands directly. No custom scripts, executables, binaries, model weights, or general-purpose runtimes are included in this Skill package.

## Third-party components in the separate prototype

The Skill ZIP contains Markdown instructions only. The following components belong to the companion standalone application, not to the Skill package:

| Component | Source | License |
|---|---|---|
| Python | https://www.python.org/ | Python Software Foundation License |
| FastAPI | https://fastapi.tiangolo.com/ | MIT |
| Next.js | https://nextjs.org/ | MIT |
| React | https://react.dev/ | MIT |
| TypeScript | https://www.typescriptlang.org/ | Apache-2.0 |
| Tailwind CSS | https://tailwindcss.com/ | MIT |
| SQLite | https://www.sqlite.org/ | Public domain |
| FFmpeg | https://ffmpeg.org/ | LGPL or GPL depending on build configuration |
| OpenVINO | https://www.openvino.ai/ | Apache-2.0 |
| OpenVINO person-detection-0202 model | https://github.com/openvinotoolkit/open_model_zoo | Follow the model-specific license distributed with the model |

The model weights and third-party application dependencies are not included in this Skill ZIP. The model-specific license must be observed if the model is redistributed separately.

## AI tools and principal uses

- ChatGPT by OpenAI assisted with project planning, technical guidance, Skill drafting, and documentation review.
- OpenVINO with the person-detection-0202 model performs local sampled person detection in the separate standalone prototype.
- The UGREEN Uliya runtime and its configured AI model are intended to interpret the user's request and produce the natural-language summary from returned NAS event data. This Skill package does not call an external model API.

## Data handling and external services

The standalone prototype stores uploaded recordings, metadata, detection records, and evidence locally. Its video inference does not require a hosted AI service.

The proposed UGREEN Skill queries surveillance data through supported UGOS capabilities. It does not intentionally transmit camera footage or event data to an external service. It does not modify or delete original recordings.

## Development and validation status

The standalone application has been developed and tested locally. The UGREEN Skill workflow is a separate deliverable and has not been executed on UGREEN NAS hardware. Its expert-agent routing and behavior require validation in the official UGREEN environment.

Blackbox Home Guard is an independent project and is not an official UGREEN product or endorsement.