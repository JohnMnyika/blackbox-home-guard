"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { useParams, useSearchParams } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Copy,
  FileVideo,
  Fingerprint,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  BrainCircuit,
  ArrowLeft,
} from "lucide-react";
import { PanelHeader, StatusPill } from "@/components/ui";

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
  const videoRef = useRef<HTMLVideoElement>(null);

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
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
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

  function seekTo(timestamp: number) {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = timestamp;
    setCurrentTime(timestamp);
    void player.play();
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#080d17] text-slate-200">
      <div className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6 xl:p-7">
        {loading ? <div className="surface-panel rounded-xl"><div className="grid min-h-[60vh] place-items-center text-xs text-slate-500"><span className="flex items-center gap-2"><Loader2 size={17} className="animate-spin text-cyan-300"/>Loading recording workspace</span></div></div>
        : error && !recording ? <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm text-red-200"><AlertCircle className="mb-2"/>{error}<Link href="/recordings" className="ml-3 text-cyan-200 underline">Return to library</Link></div>
        : recording ? <>
          <section className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><Link href="/recordings" className="mb-2 inline-flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-cyan-200"><ArrowLeft size={12}/>Recordings library</Link><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-blue-300">Video analysis workstation</p><h1 className="mt-1.5 max-w-4xl truncate text-xl font-semibold text-white sm:text-2xl" title={recording.original_filename}>{recording.original_filename}</h1><p className="mt-1.5 text-[10px] text-slate-500">Imported {new Date(recording.created_at).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})} UTC</p></div><StatusPill label={analysis?.status??"Not analyzed"} tone={analysis?.status==="completed"?"emerald":analysis?.status==="failed"?"red":analyzing?"cyan":"slate"}/></section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
            <div className="space-y-4">
              <article className="surface-panel overflow-hidden rounded-xl">
                <div className="relative bg-black"><video ref={videoRef} key={recording.id} controls playsInline preload="metadata" className="aspect-video max-h-[72vh] w-full bg-black" src={`${API_URL}/api/v1/recordings/${recording.id}/video`} onTimeUpdate={(event)=>setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event)=>{if(Number.isFinite(requestedTimestamp)&&requestedTimestamp>0){event.currentTarget.currentTime=requestedTimestamp;setCurrentTime(requestedTimestamp);}}}>Your browser cannot play this video format.</video><span className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[9px] text-slate-200">LOCAL RECORDING</span><span className="absolute bottom-12 right-3 rounded bg-black/75 px-2 py-1 text-[9px] tabular-nums text-white">{formatDuration(currentTime)} / {formatDuration(recording.duration)}</span></div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#25334a] bg-[#111c2e] px-4 py-3 text-[9px] text-slate-400"><span>{recording.playback_status==="converted"?"Compatible H.264 playback copy":"Original uploaded footage"}</span><span>HTTP range playback · source remains unchanged</span></div>
              </article>
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Detection timeline" subtitle="Select a marker to jump to the matching timestamp" icon={Activity}/><div className="px-4 py-5 sm:px-5">{detections.length&&recording.duration? <><div className="relative h-10 rounded-lg border border-[#25334a] bg-[#0b1422]"><div className="absolute left-2 right-2 top-1/2 h-px bg-[#344660]"/>{detections.map((detection)=>{const left=Math.max(0,Math.min(100,detection.timestamp_seconds/(recording.duration??1)*100));return <button key={detection.id} onClick={()=>{setSelectedDetection(detection);seekTo(detection.timestamp_seconds);}} title={`${formatDuration(detection.timestamp_seconds)} · ${(detection.confidence*100).toFixed(1)}% confidence`} aria-label={`Seek to detection at ${formatDuration(detection.timestamp_seconds)}`} className={`absolute top-1/2 h-4 w-2 -translate-y-1/2 rounded-sm border border-[#0b1422] ${selectedDetection?.id===detection.id?"bg-cyan-200 ring-2 ring-cyan-300/30":"bg-blue-400 hover:bg-cyan-300"}`} style={{left:`calc(${left}% - 4px)`}}/>;})}</div><div className="mt-2 flex justify-between text-[9px] tabular-nums text-slate-600"><span>00:00</span><span>{formatDuration(recording.duration)}</span></div></>:<p className="text-[10px] text-slate-500">Run person analysis to add timestamp markers to this recording.</p>}
                {selectedDetection&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-3"><Image unoptimized width={112} height={72} src={`${API_URL}${selectedDetection.evidence_url}`} alt="Selected detection evidence" className="h-14 w-24 rounded-md object-cover"/><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-white">Person · {(selectedDetection.confidence*100).toFixed(1)}% confidence</p><p className="mt-1 text-[9px] text-slate-400">{formatDuration(selectedDetection.timestamp_seconds)} · box {selectedDetection.bbox_x},{selectedDetection.bbox_y} {selectedDetection.bbox_width}×{selectedDetection.bbox_height}px</p></div><button onClick={()=>seekTo(selectedDetection.timestamp_seconds)} className="rounded-md border border-cyan-400/20 px-3 py-2 text-[9px] text-cyan-200 hover:bg-cyan-400/10">Jump to frame</button></div>}</div></article>
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Detection evidence" subtitle={`${detections.length} persisted person events`} icon={Fingerprint}/>{detections.length?<div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">{detections.map((detection)=><button key={detection.id} onClick={()=>{setSelectedDetection(detection);seekTo(detection.timestamp_seconds);}} className={`overflow-hidden rounded-lg border text-left transition ${selectedDetection?.id===detection.id?"border-cyan-300/50 bg-cyan-400/[0.04]":"border-[#25334a] bg-[#0d1524] hover:border-blue-400/30"}`}><Image unoptimized width={480} height={270} src={`${API_URL}${detection.evidence_url}`} alt={`Person detection at ${formatDuration(detection.timestamp_seconds)}`} className="aspect-video w-full object-cover"/><div className="flex items-center justify-between gap-2 p-3"><span><span className="block text-[10px] font-medium text-slate-100">{formatDuration(detection.timestamp_seconds)}</span><span className="mt-1 block text-[9px] text-slate-500">Person · {detection.bbox_width}×{detection.bbox_height}px</span></span><StatusPill label={`${(detection.confidence*100).toFixed(1)}%`} tone={detection.confidence>=.85?"emerald":"blue"}/></div></button>)}</div>:<div className="p-4 text-[10px] text-slate-500">No detections are stored for this recording yet.</div>}</article>
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Extracted preview frames" subtitle={`${frames.length} locally stored preview images`} icon={ImageIcon}/>{frames.length?<div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">{frames.map((frame,index)=><a key={frame} href={`${API_URL}${frame}`} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#25334a] bg-[#0d1524]"><Image unoptimized width={640} height={360} src={`${API_URL}${frame}`} alt={`Extracted frame ${index+1}`} className="aspect-video w-full object-cover"/><p className="px-3 py-2 text-[9px] text-slate-500">Preview {index+1}</p></a>)}</div>:<div className="p-4 text-[10px] text-slate-500">No extracted preview frames are available.</div>}</article>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-[88px]">
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Analysis controls" subtitle="Sampled local person inference" icon={BrainCircuit}/><div className="space-y-4 p-4"><p className="text-[10px] leading-relaxed text-slate-500">Runs the OpenVINO person model on sampled frames. This is offline footage analysis, not a live camera feed.</p><div className="grid grid-cols-[1fr_auto] items-center gap-2"><label htmlFor="sample-interval" className="text-[10px] text-slate-400">Sample every</label><select id="sample-interval" value={intervalSeconds} onChange={(event)=>setIntervalSeconds(Number(event.target.value))} disabled={analyzing} className="rounded-md border border-[#25334a] bg-[#080d17] px-2.5 py-2 text-[10px] text-white"><option value={1}>1 second</option><option value={2}>2 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></div><button onClick={runAnalysis} disabled={analyzing} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">{analyzing?<Loader2 size={14} className="animate-spin"/>:<BrainCircuit size={14}/>} {analyzing?"Analysis running":"Start analysis"}</button>{analysisMessage&&<p role="status" className="text-[9px] text-emerald-300">{analysisMessage}</p>}{analysis&&<div className="rounded-lg border border-[#25334a] bg-[#0d1524] p-3"><div className="flex items-center justify-between gap-2"><StatusPill label={analysis.status} tone={analysis.status==="completed"?"emerald":analysis.status==="failed"?"red":"cyan"}/><span className="text-[9px] text-slate-500">{analysis.progress_percent}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded bg-[#25334a]"><div className="h-full rounded bg-cyan-300 transition-[width]" style={{width:`${analysis.progress_percent}%`}}/></div><p className="mt-2 text-[9px] text-slate-500">{analysis.analyzed_frames??"—"} frames sampled · {analysis.total_detections} detections{analysis.processing_seconds!==null?` · ${analysis.processing_seconds}s`:""}</p>{analysis.error_message&&<p role="alert" className="mt-2 text-[9px] text-red-300">{analysis.error_message}</p>}</div>}</div></article>
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Recording metadata" icon={FileVideo}/><div className="divide-y divide-[#25334a]/70 px-4">{[["Duration",formatDuration(recording.duration)],["File size",formatBytes(recording.file_size)],["Resolution",`${recording.width??"?"} × ${recording.height??"?"}`],["Frame rate",recording.frame_rate?`${recording.frame_rate} FPS`:"Unknown"],["Codec",recording.video_codec??"Unknown"],["Preview frames",String(recording.frame_count)],["AI detections",String(detections.length)]].map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 py-2.5"><span className="text-[9px] text-slate-500">{label}</span><span className="text-right text-[10px] text-slate-200">{value}</span></div>)}</div></article>
              <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Integrity fingerprint" icon={Fingerprint}/><div className="p-4"><p className="break-all rounded-md border border-[#25334a] bg-[#080d17] p-3 font-mono text-[9px] leading-relaxed text-cyan-100">{recording.sha256}</p><button onClick={copyHash} className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#344660] px-3 py-2 text-[9px] text-slate-300 hover:text-white">{copied?<CheckCircle2 size={12}/>:<Copy size={12}/>} {copied?"Copied":"Copy SHA-256"}</button><p className="mt-2 text-[9px] leading-relaxed text-slate-600">A file fingerprint detects later changes; it does not establish source authenticity.</p></div></article>
              {error&&<div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.05] p-3 text-[10px] text-red-200"><AlertCircle size={13} className="mb-1"/>{error}</div>}
            </aside>
          </section>
        </> : null}
        <footer className="border-t border-[#25334a] pt-4 text-[9px] text-slate-600">BLACKBOX HOME GUARD · LOCAL VIDEO ANALYSIS WORKSTATION</footer>
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
      <AppShell title="Recording detail"><RecordingDetailsContent /></AppShell>
    </Suspense>
  );
}
