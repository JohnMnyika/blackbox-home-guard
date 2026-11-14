"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  FileVideo,
  Fingerprint,
  HardDrive,
  Image as ImageIcon,
  Loader2,
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
  duration: number | null;
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  video_codec: string | null;
  format_name: string | null;
  frame_count: number;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

type FrameData = {
  frames: string[];
  total: number;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "Unknown";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);

  return hours > 0
    ? `${hours}h ${minutes}m ${remaining}s`
    : `${minutes}m ${remaining}s`;
}

function RecordingDetailsContent() {
  const params = useParams<{ id: string }>();
  const recordingId = params.id;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!recordingId) return;

    let cancelled = false;

    async function loadRecording() {
      try {
        setLoading(true);
        setError("");

        const [recordingResponse, framesResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/recordings/${recordingId}`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/api/v1/recordings/${recordingId}/frames`, {
            cache: "no-store",
          }),
        ]);

        if (!recordingResponse.ok) {
          throw new Error("Unable to load this recording.");
        }

        const recordingData = await recordingResponse.json();
        const frameData: FrameData = framesResponse.ok
          ? await framesResponse.json()
          : { frames: [], total: 0 };

        if (!cancelled) {
          setRecording(recordingData);
          setFrames(frameData.frames ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load recording."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecording();

    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  async function copyHash() {
    if (!recording) return;

    try {
      await navigator.clipboard.writeText(recording.sha256);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy the SHA-256 fingerprint.");
    }
  }

  return (
    <main className="min-h-screen bg-[#090e15] text-slate-200">
      <header className="flex min-h-20 items-center justify-between border-b border-white/[0.07] bg-[#0c131d] px-5 py-4 md:px-8">
        <div>
          <Link
            href="/recordings"
            className="mb-1 flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-400"
          >
            <ArrowLeft size={14} /> Back to recordings
          </Link>
          <h1 className="text-lg font-semibold text-white">
            Recording inspection
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-400">
          <ShieldCheck size={15} />
          Local evidence
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-cyan-400" size={28} />
          </div>
        ) : error && !recording ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-5 text-sm text-red-300">
            <AlertCircle className="mb-2" />
            {error}
          </div>
        ) : recording ? (
          <>
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Evidence inspection
              </p>
              <h2 className="mt-2 break-all text-2xl font-semibold text-white">
                {recording.original_filename}
              </h2>
              <p className="mt-2 text-xs text-slate-500">
                Imported {new Date(recording.created_at).toLocaleString()}
              </p>
            </section>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-black">
              <video
                key={recording.id}
                controls
                playsInline
                preload="metadata"
                className="aspect-video max-h-[70vh] w-full bg-black"
                src={`${API_URL}/api/v1/recordings/${recording.id}/video`}
              >
                Your browser cannot play this video format.
              </video>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-[#111923] px-4 py-3 text-[11px] text-slate-400">
                <span>Original uploaded footage</span>
                <span>Playback does not modify the stored evidence.</span>
              </div>
            </section>

            {error && (
              <div className="rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "File size",
                  value: formatBytes(recording.file_size),
                  icon: HardDrive,
                },
                {
                  label: "Duration",
                  value: formatDuration(recording.duration),
                  icon: Calendar,
                },
                {
                  label: "Resolution",
                  value: `${recording.width ?? "?"} × ${recording.height ?? "?"}`,
                  icon: FileVideo,
                },
                {
                  label: "Extracted frames",
                  value: String(recording.frame_count),
                  icon: ImageIcon,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/[0.07] bg-[#111923] p-4"
                  >
                    <Icon size={18} className="text-cyan-400" />
                    <p className="mt-3 text-lg font-semibold text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </section>

            <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Fingerprint size={17} className="text-cyan-400" />
                Evidence integrity
              </h3>

              <p className="mt-4 text-[10px] uppercase tracking-wider text-slate-500">
                SHA-256 fingerprint
              </p>
              <code className="mt-2 block break-all text-xs leading-relaxed text-cyan-300">
                {recording.sha256}
              </code>

              <button
                onClick={copyHash}
                className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.10] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05]"
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy fingerprint"}
              </button>
            </section>

            <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
              <h3 className="text-sm font-semibold text-white">
                Video metadata
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Status", recording.status],
                  ["Video codec", recording.video_codec ?? "Unknown"],
                  ["Format", recording.format_name ?? "Unknown"],
                  [
                    "Frame rate",
                    recording.frame_rate
                      ? `${recording.frame_rate} FPS`
                      : "Unknown",
                  ],
                  ["Recording ID", recording.id],
                  ["Original filename", recording.original_filename],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ImageIcon size={17} className="text-cyan-400" />
                Extracted frames ({frames.length})
              </h3>

              {frames.length ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {frames.map((frame, index) => (
                    <a
                      key={frame}
                      href={`${API_URL}${frame}`}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/20"
                    >
                      <img
                        src={`${API_URL}${frame}`}
                        alt={`Extracted frame ${index + 1}`}
                        className="aspect-video w-full object-contain"
                      />
                      <p className="p-3 text-[10px] text-slate-400">
                        Frame {index + 1} · {frame.split("/").pop()}
                      </p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">
                  No extracted frames are available.
                </p>
              )}
            </section>
          </>
        ) : null}

        <footer className="border-t border-white/[0.06] pt-5 text-[10px] text-slate-600">
          BlackBox Home Guard · Local video evidence inspection
        </footer>
      </div>
    </main>
  );
}


export default function RecordingDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b12] p-6 text-white">
          <div className="mx-auto max-w-6xl">
            Loading recording details...
          </div>
        </main>
      }
    >
      <RecordingDetailsContent />
    </Suspense>
  );
}
