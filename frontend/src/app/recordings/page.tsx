"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  Upload,
  FileVideo,
  HardDrive,
  Fingerprint,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Copy,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Recording = {
  id: string;
  original_filename: string;
  file_size: number;
  sha256: string;
  duration: number;
  width: number;
  height: number;
  frame_rate: number | null;
  video_codec: string;
  frame_count: number;
  status: string;
  playback_status?: "original" | "converted" | "failed";
  playback_codec?: string | null;
  playback_format?: string | null;
  playback_size?: number | null;
  created_at: string;
};

type FrameResponse = {
  recording_id: string;
  total: number;
  frames: string[];
};
type UploadResult = { filename: string; frame_count: number };

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "Unknown";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);

  return hours > 0
    ? `${hours}h ${minutes}m ${remaining}s`
    : `${minutes}m ${remaining}s`;
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [frames, setFrames] = useState<Record<string, string[]>>({});
  const [frameLoading, setFrameLoading] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/v1/recordings`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Unable to load recordings.");

      const data = await response.json();
      setRecordings(data.recordings ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend connection failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadRecordings);
  }, [loadRecordings]);

  async function uploadVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a video file first.");
      return;
    }

    const allowedExtensions = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".mpeg", ".mpg"];
    const extension = selectedFile.name.slice(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      setError("Choose a supported video file (MP4, MOV, MKV, AVI, WEBM, M4V, MPEG, or MPG).");
      return;
    }
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
      setError("Video exceeds the 2 GB upload limit.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const data = await new Promise<UploadResult>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", `${API_URL}/api/v1/recordings`);
        request.upload.onprogress = (progress) => {
          if (progress.lengthComputable) setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
        };
        request.onerror = () => reject(new Error("Network error while uploading the video."));
        request.onload = () => {
          let payload: UploadResult & { detail?: string };
          try { payload = JSON.parse(request.responseText) as UploadResult & { detail?: string }; }
          catch { reject(new Error("The backend returned an unreadable upload response.")); return; }
          if (request.status < 200 || request.status >= 300) reject(new Error(payload.detail || "Video upload failed."));
          else resolve(payload);
        };
        request.send(formData);
      });

      setSuccess(
        `Successfully imported ${data.filename}. ${data.frame_count} frames extracted.`
      );
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "video-upload"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      await loadRecordings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function toggleFrames(recordingId: string) {
    if (expandedId === recordingId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(recordingId);

    if (frames[recordingId]) return;

    setFrameLoading(recordingId);

    try {
      const response = await fetch(
        `${API_URL}/api/v1/recordings/${recordingId}/frames`
      );

      if (!response.ok) throw new Error("Unable to retrieve frames.");

      const data: FrameResponse = await response.json();

      setFrames((previous) => ({
        ...previous,
        [recordingId]: data.frames,
      }));
    } catch {
      setError("Unable to load extracted frames.");
    } finally {
      setFrameLoading(null);
    }
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      setSuccess("SHA-256 fingerprint copied to clipboard.");
    } catch {
      setError("Could not copy the fingerprint.");
    }
  }

  return (
    <main className="min-h-screen bg-[#090e15] text-slate-200">
      <header className="flex h-20 items-center justify-between border-b border-white/[0.07] bg-[#0c131d] px-5 md:px-8">
        <div>
          <Link
            href="/"
            className="mb-1 flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-400"
          >
            <ArrowLeft size={14} /> Back to overview
          </Link>
          <h1 className="text-lg font-semibold text-white">
            Video recordings
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-400">
          <ShieldCheck size={15} />
          Local storage
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Video intelligence
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
            Recording library
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Import, inspect and manage your surveillance video evidence.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
            <FileVideo className="text-cyan-400" size={20} />
            <p className="mt-4 text-2xl font-semibold text-white">
              {recordings.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Imported recordings</p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
            <HardDrive className="text-cyan-400" size={20} />
            <p className="mt-4 text-2xl font-semibold text-white">
              {formatBytes(
                recordings.reduce((total, item) => total + item.file_size, 0)
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total video storage</p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
            <ImageIcon className="text-cyan-400" size={20} />
            <p className="mt-4 text-2xl font-semibold text-white">
              {recordings.reduce(
                (total, item) => total + item.frame_count,
                0
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">Extracted frames</p>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-400/10 p-2.5">
              <Upload className="text-cyan-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Import surveillance footage
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Upload a video for metadata extraction and forensic processing.
              </p>
            </div>
          </div>

          <form onSubmit={uploadVideo} className="mt-6 space-y-4">
            <label
              htmlFor="video-upload"
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/[0.03]"
            >
              <Upload size={25} className="text-cyan-400" />
              <span className="mt-3 text-sm font-medium text-slate-200">
                {selectedFile ? selectedFile.name : "Choose a video recording"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                MP4, MOV, MKV, AVI, WEBM and other supported formats · Maximum
                2 GB
              </span>
              <input
                id="video-upload"
                type="file"
                accept=".mp4,.mov,.mkv,.avi,.webm,.m4v,.mpeg,.mpg,video/*"
                className="hidden"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setError("");
                  setSuccess("");
                }}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                Original footage is retained separately from extracted frames.
              </p>

              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Processing video...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Import recording
                  </>
                )}
              </button>
            </div>
            {uploading && <div aria-live="polite"><div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>{uploadProgress === 100 ? "Upload complete · validating and processing locally" : "Uploading video"}</span><span>{uploadProgress}%</span></div><div role="progressbar" aria-label="Video upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${uploadProgress}%` }} /></div></div>}
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-xs text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-xs text-emerald-300">
              <CheckCircle2 size={16} className="shrink-0" />
              {success}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111923]">
          <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Imported recordings
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Stored video evidence and processing results
              </p>
            </div>
            <button
              onClick={loadRecordings}
              className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05]"
              aria-label="Refresh recordings"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-cyan-400" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <FileVideo size={30} className="text-slate-600" />
              <p className="mt-4 text-sm text-slate-300">
                No recordings imported yet
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Upload your first CCTV recording above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {recordings.map((recording) => (
                <div key={recording.id} className="p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-cyan-400/10 p-3">
                        <FileVideo className="text-cyan-400" size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="break-all text-sm font-medium text-white">
                          {recording.original_filename}
                        </h4>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(recording.created_at).toLocaleString()}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                          <span>{formatBytes(recording.file_size)}</span>
                          <span>
                            {recording.width} × {recording.height}
                          </span>
                          <span>{formatDuration(recording.duration)}</span>
                          <span>{recording.frame_count} frames</span>
                          <span>{recording.video_codec}</span>
                          <span>
                            Playback: {
                              recording.playback_status === "converted"
                                ? "H.264 copy ready"
                                : recording.playback_status === "failed"
                                  ? "Conversion unavailable"
                                  : "Original"
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/recordings/${recording.id}`}
                        className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                      >
                        <FileVideo size={15} />
                        Open recording
                      </Link>

                      <button
                        onClick={() => toggleFrames(recording.id)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-4 py-2.5 text-xs font-medium text-cyan-300 hover:bg-cyan-400/10"
                      >
                        <ImageIcon size={15} />
                        {expandedId === recording.id
                          ? "Hide frames"
                          : "Inspect frames"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/10 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <Fingerprint size={14} />
                      SHA-256 fingerprint
                    </div>
                    <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <code className="break-all text-[10px] leading-relaxed text-cyan-300">
                        {recording.sha256}
                      </code>
                      <button
                        onClick={() => copyHash(recording.sha256)}
                        className="flex shrink-0 items-center gap-2 text-xs text-slate-400 hover:text-white"
                      >
                        <Copy size={13} />
                        Copy
                      </button>
                    </div>
                  </div>

                  {expandedId === recording.id && (
                    <div className="mt-5 border-t border-white/[0.06] pt-5">
                      <h5 className="mb-4 flex items-center gap-2 text-xs font-semibold text-white">
                        <ImageIcon size={15} className="text-cyan-400" />
                        Extracted video frames
                      </h5>

                      {frameLoading === recording.id ? (
                        <Loader2 className="animate-spin text-cyan-400" />
                      ) : frames[recording.id]?.length ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {frames[recording.id].map((frame, index) => (
                            <div
                              key={frame}
                              className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/20"
                            >
                              <a
                                href={`${API_URL}${frame}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Image
                                  unoptimized
                                  width={640}
                                  height={360}
                                  src={`${API_URL}${frame}`}
                                  alt={`Extracted frame ${index + 1}`}
                                  className="aspect-video w-full object-contain"
                                />
                              </a>
                              <p className="p-2 text-[10px] text-slate-500">
                                Frame {index + 1} · {frame.split("/").pop()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No frames are available for this recording.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="flex items-center gap-2 border-t border-white/[0.06] pt-5 text-[10px] text-slate-600">
          <LockKeyholeIcon />
          BlackBox Home Guard · Local video evidence library
        </footer>
      </div>
    </main>
  );
}

function LockKeyholeIcon() {
  return <ShieldCheck size={14} className="text-emerald-500" />;
}
