"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
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
  BrainCircuit,
  Play,
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
  playback_path?: string | null;
  playback_size?: number | null;
  playback_sha256?: string | null;
  playback_codec?: string | null;
  playback_format?: string | null;
  playback_status?: "original" | "converted" | "failed";
};

type FrameData = {
  frames: string[];
  total: number;
};
type Detection = { id: string; analysis_id: string; timestamp_seconds: number; confidence: number; detection_type: string; evidence_url: string; bbox_x:number; bbox_y:number; bbox_width:number; bbox_height:number };
type AnalysisRun = { id:string; recording_id:string; status:"queued"|"running"|"completed"|"failed"; interval_seconds:number|null; duration_seconds:number|null; analyzed_frames:number|null; total_detections:number; processing_seconds:number|null; progress_percent:number; error_message:string|null; created_at:string; completed_at:string|null };

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
  const searchParams = useSearchParams();
  const requestedTimestamp = Number(searchParams.get("t"));
  const recordingId = params.id;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [intervalSeconds, setIntervalSeconds] = useState(2);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const activeAnalysisId = analysis?.id;
  const activeAnalysisStatus = analysis?.status;

  useEffect(() => {
    if (!recordingId) return;

    let cancelled = false;

    async function loadRecording() {
      try {
        setLoading(true);
        setError("");

        const [recordingResponse, framesResponse, detectionResponse, analysisResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/recordings/${recordingId}`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/api/v1/recordings/${recordingId}/frames`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/api/v1/recordings/${recordingId}/detections`, { cache: "no-store" }),
          fetch(`${API_URL}/api/v1/recordings/${recordingId}/analyses`, { cache: "no-store" }),
        ]);

        if (!recordingResponse.ok) {
          throw new Error("Unable to load this recording.");
        }

        const recordingData = await recordingResponse.json();
        const frameData: FrameData = framesResponse.ok
          ? await framesResponse.json()
          : { frames: [], total: 0 };
        const detectionData = detectionResponse.ok ? await detectionResponse.json() : { detections: [] };
        const analysisData = analysisResponse.ok ? await analysisResponse.json() : { analyses: [] };

        if (!cancelled) {
          setRecording(recordingData);
          setFrames(frameData.frames ?? []);
          setDetections(detectionData.detections ?? []);
          const latest: AnalysisRun | null = analysisData.analyses?.[0] ?? null;
          setAnalysis(latest);
          if (latest?.status === "queued" || latest?.status === "running") setAnalyzing(true);
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

  useEffect(() => {
    if (!activeAnalysisId || (activeAnalysisStatus !== "queued" && activeAnalysisStatus !== "running")) return;
    let cancelled = false;
    let requestActive = false;
    const poll = async () => {
      if (requestActive) return;
      requestActive = true;
      try {
        const response = await fetch(`${API_URL}/api/v1/analyses/${activeAnalysisId}`, { cache: "no-store" });
        const latest: AnalysisRun = await response.json();
        if (!response.ok) throw new Error("Unable to refresh analysis status.");
        if (cancelled) return;
        setAnalysis(latest);
        if (latest.status === "completed" || latest.status === "failed") {
          setAnalyzing(false);
          if (latest.status === "completed") {
            setAnalysisMessage(`Analysis complete · ${latest.analyzed_frames ?? 0} frames · ${latest.total_detections} detections · ${latest.processing_seconds ?? 0}s`);
            const detectionsResponse = await fetch(`${API_URL}/api/v1/recordings/${recordingId}/detections`, { cache: "no-store" });
            if (detectionsResponse.ok) setDetections((await detectionsResponse.json()).detections ?? []);
          } else {
            setError(latest.error_message || "Video analysis failed.");
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to refresh analysis status.");
      } finally { requestActive = false; }
    };
    void poll();
    const timer = window.setInterval(poll, 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeAnalysisId, activeAnalysisStatus, recordingId]);

  async function runAnalysis() {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisMessage("Queueing local OpenVINO analysis…");
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/recordings/${recordingId}/analyze?interval_seconds=${intervalSeconds}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Video analysis failed.");
      setAnalysis(data);
      setAnalysisMessage("Analysis queued. Progress updates as sampled frames are processed.");
    } catch (err) {
      setAnalysisMessage("");
      setError(err instanceof Error ? err.message : "Video analysis failed.");
      setAnalyzing(false);
    }
  }

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
                onLoadedMetadata={(event) => {
                  if (Number.isFinite(requestedTimestamp) && requestedTimestamp > 0) event.currentTarget.currentTime = requestedTimestamp;
                }}
              >
                Your browser cannot play this video format.
              </video>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-[#111923] px-4 py-3 text-[11px] text-slate-400">
                <span>
                  {recording.playback_status === "converted"
                    ? "Compatible H.264 playback copy"
                    : "Original uploaded footage"}
                </span>
                <span>
                  Original evidence remains unchanged.
                </span>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><BrainCircuit size={17} className="text-cyan-400" />Local person analysis</h3><p className="mt-1 text-xs text-slate-500">OpenVINO CPU · Results are detections, not security incident claims.</p></div>
                <div className="flex items-center gap-2"><label htmlFor="sample-interval" className="text-xs text-slate-400">Sample every</label><select id="sample-interval" value={intervalSeconds} onChange={(event) => setIntervalSeconds(Number(event.target.value))} disabled={analyzing} className="rounded border border-white/10 bg-[#0b1119] px-2 py-2 text-xs text-white"><option value={1}>1 second</option><option value={2}>2 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select><button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{analyzing ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}{analyzing ? "Analyzing" : "Analyze video"}</button></div>
              </div>
              {analysisMessage && <p role="status" className="mt-4 text-xs text-emerald-300">{analysisMessage}</p>}
              {analysis && <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium uppercase tracking-wide text-slate-300">{analysis.status}</span><span className="text-slate-400">{analysis.analyzed_frames === null ? "frame count unavailable" : `${analysis.analyzed_frames} sampled frames`} · {analysis.total_detections} detections{analysis.processing_seconds !== null ? ` · ${analysis.processing_seconds}s` : ""}</span></div>{analysis.status === "queued" || analysis.status === "running" ? <div className="mt-3"><div className="mb-1 flex justify-between text-[10px] text-slate-500"><span>Local processing progress</span><span>{analysis.progress_percent}%</span></div><div role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analysis.progress_percent} className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400 transition-[width]" style={{width:`${analysis.progress_percent}%`}}/></div></div> : null}{analysis.status === "failed" && analysis.error_message && <p className="mt-2 text-xs text-red-300">{analysis.error_message}</p>}</div>}
              <div className="mt-4 space-y-2">
                {detections.length ? detections.map((detection) => <div key={detection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] p-3"><div className="flex items-center gap-3"><Image unoptimized width={96} height={56} src={`${API_URL}${detection.evidence_url}`} alt="Person detection evidence" className="h-14 w-24 rounded object-cover" /><div><p className="text-xs font-medium text-white">Person · {(detection.confidence * 100).toFixed(1)}% confidence</p><p className="mt-1 text-[11px] text-slate-500">{formatDuration(detection.timestamp_seconds)} · box {detection.bbox_x},{detection.bbox_y} {detection.bbox_width}×{detection.bbox_height}px</p><p className="mt-1 text-[10px] text-slate-600">Analysis {detection.analysis_id}</p></div></div><button onClick={() => { const player = document.querySelector("video"); if (player) { player.currentTime = detection.timestamp_seconds; player.play(); } }} className="flex items-center gap-1 text-xs text-cyan-300"><Play size={13} />Jump to video</button></div>) : <p className="py-3 text-xs text-slate-500">No detections are stored for this recording yet.</p>}
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
                  ["Original format", recording.format_name ?? "Unknown"],
                  [
                    "Playback status",
                    recording.playback_status === "converted"
                      ? "Compatible copy generated"
                      : recording.playback_status === "failed"
                        ? "Conversion failed; original retained"
                        : "Original is browser-compatible",
                  ],
                  [
                    "Playback codec",
                    recording.playback_codec ?? recording.video_codec ?? "Unknown",
                  ],
                  [
                    "Playback format",
                    recording.playback_format ?? recording.format_name ?? "Original",
                  ],
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
                      <Image
                        unoptimized
                        width={640}
                        height={360}
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
