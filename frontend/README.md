# BlackBox Home Guard

**Privacy-first, locally processed AI video surveillance and forensics platform.**

BlackBox Home Guard is a self-hosted video surveillance and forensic analysis project designed to help users upload, manage, inspect and analyse video recordings locally.

The project prioritises privacy, local processing, recording integrity and extensibility for future AI-powered surveillance capabilities.

## Current Features

### Video Management
- Upload video recordings through the web interface.
- Store recordings locally.
- Retrieve recording metadata.
- Calculate SHA256 checksums for file integrity verification.
- Maintain recording information in an SQLite database.

### Video Processing
- Extract video metadata using FFprobe.
- Extract preview frames using FFmpeg.
- Retrieve and display extracted frames.
- Validate frame filenames before serving them.

### Video Playback
- Dedicated recording details page.
- Browser-based video playback.
- HTTP byte-range streaming to support seeking.
- H.264 MP4 playback testing.
- Original uploaded recordings remain stored separately from browser playback.

### Backend and Security
- FastAPI REST API.
- SQLite database.
- CORS configuration for local frontend development.
- Recording file validation.
- Protected file-path resolution for video streaming.
- Local-first processing architecture.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | SQLite |
| Video processing | FFmpeg, FFprobe |
| Video playback | HTML5 Video |
| Integrity verification | SHA256 |
| Development environment | Kali Linux |

## Project Structure

```text
blackbox-home-guard/
├── ai_engine/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   └── main.py
│   └── data/
│       ├── recordings/
│       └── blackbox.db
├── deployment/
├── docs/
├── frontend/
│   └── src/
│       └── app/
│           └── recordings/
├── video_engine/
├── sample_videos/
├── .venv/
└── README.md
```

## Requirements

- Python 3.10 or newer
- Node.js and npm
- FFmpeg and FFprobe
- Git

## Installation and Development

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd blackbox-home-guard
```

Replace `YOUR_REPOSITORY_URL` with your Git repository URL.

### 2. Set up the Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

### 3. Install FFmpeg

On Kali Linux:

```bash
sudo apt update
sudo apt install ffmpeg
```

Verify installation:

```bash
ffmpeg -version
ffprobe -version
```

### 4. Start the backend

From the project root:

```bash
source .venv/bin/activate

uvicorn app.main:app \
  --reload \
  --host 127.0.0.1 \
  --port 8000 \
  --app-dir backend
```

Backend:

`http://127.0.0.1:8000`

API health check:

`http://127.0.0.1:8000/api/v1/health`

Interactive API documentation:

`http://127.0.0.1:8000/docs`

### 5. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

`http://localhost:3000`

## Available API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Backend welcome endpoint |
| GET | `/api/v1/health` | Backend health check |
| GET | `/api/v1/system/info` | System information |
| POST | `/api/v1/recordings` | Upload a recording |
| GET | `/api/v1/recordings` | List recordings |
| GET | `/api/v1/recordings/{id}` | Retrieve recording details |
| GET | `/api/v1/recordings/{id}/frames` | List extracted frames |
| GET | `/api/v1/recordings/{id}/frames/{filename}` | Retrieve a frame |
| GET | `/api/v1/recordings/{id}/video` | Stream a recording |

## Video Compatibility

The project uses FFmpeg and FFprobe to inspect and process video files.

H.264 encoded MP4 videos are recommended for browser playback compatibility.

The playback endpoint supports HTTP byte-range requests, allowing compatible browsers to seek through recordings without downloading the entire file first.

For testing, a sample H.264 video can be generated using FFmpeg.

## Data and Privacy

BlackBox Home Guard is designed around local processing.

- Recordings are stored locally.
- Recording metadata is stored in SQLite.
- SHA256 checksums are calculated for integrity verification.
- The current implementation does not require cloud AI services.
- Uploaded recordings should be backed up securely.

**Important:** SHA256 checksums help verify file integrity; they do not independently prove the authenticity or chain of custody of surveillance evidence.

## Current Development Status

### Implemented
- [x] FastAPI backend
- [x] SQLite recording database
- [x] Video upload and local storage
- [x] SHA256 file integrity checks
- [x] Video metadata extraction
- [x] Frame extraction and preview
- [x] Recordings library
- [x] Recording details page
- [x] HTTP byte-range video streaming
- [x] H.264 browser playback testing

### Planned
- [ ] Automatic video codec compatibility detection
- [ ] H.264 playback-copy generation when required
- [ ] AI-powered object detection
- [ ] Person and vehicle detection
- [ ] Event and motion detection
- [ ] Intelligent video search
- [ ] Timeline-based forensic investigation
- [ ] Alert and notification system
- [ ] User authentication and access control
- [ ] UGREEN NAS / UGOS deployment
- [ ] Automated backups and retention policies

## Project Vision

The long-term goal is to develop BlackBox Home Guard into a privacy-first intelligent video surveillance and digital forensics platform that can run independently on local hardware or a home NAS.

The system will progressively introduce AI-assisted detection, searchable events, forensic investigation tools and intelligent monitoring while keeping users in control of their recordings and data.

---

**BlackBox Home Guard — Your footage. Your intelligence. Your control.**