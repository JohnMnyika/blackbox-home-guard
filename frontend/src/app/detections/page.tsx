"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Detection = {
  id: string; recording_id: string; analysis_id: string; original_filename: string;
  timestamp_seconds: number; confidence: number; detection_type: string;
  evidence_url: string; bbox_x: number; bbox_y: number; bbox_width: number; bbox_height: number;
};

export default function DetectionsPage() {
  const [items, setItems] = useState<Detection[]>([]);
  const [recordingNames, setRecordingNames] = useState<Record<string, string>>({});
  const [recordingFilter, setRecordingFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "500" });
        if (recordingFilter !== "all") params.set("recording_id", recordingFilter);
        if (typeFilter !== "all") params.set("detection_type", typeFilter);
        const response = await fetch(`${API}/api/v1/detections?${params}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Unable to load detection events.");
        if (!cancelled) {
          setItems(result.detections ?? []);
          setRecordingNames((previous) => ({ ...previous, ...Object.fromEntries((result.detections ?? []).map((item: Detection) => [item.recording_id, item.original_filename])) }));
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Backend connection failed.");
      } finally { if (!cancelled) setLoading(false); }
    };
    void Promise.resolve().then(load);
    return () => { cancelled = true; };
  }, [recordingFilter, typeFilter]);

  const recordingOptions = Object.entries(recordingNames);

  return <main className="min-h-screen bg-[#090e15] p-5 text-slate-200 md:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/" className="text-xs text-cyan-300">← Overview</Link>
    <h1 className="mt-4 text-2xl font-semibold text-white">Detection timeline</h1>
    <p className="mt-2 text-sm text-slate-400">Local person detections with recording time, confidence, and bounding-box details.</p>
    <div className="mt-6 grid gap-3 rounded-xl border border-white/[0.08] bg-[#111923] p-4 sm:grid-cols-2">
      <label className="text-xs text-slate-400">Recording<select value={recordingFilter} onChange={(event) => setRecordingFilter(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1119] px-3 py-2.5 text-white"><option value="all">All recordings</option>{recordingOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs text-slate-400">Detection type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1119] px-3 py-2.5 text-white"><option value="all">All types</option><option value="person">Person</option></select></label>
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-300">{error}</p>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan-400"/></div> : !items.length ? <p className="mt-6 rounded-xl border border-white/10 bg-[#111923] p-6 text-sm text-slate-400">No detection events match these filters.</p> : <div className="mt-6 space-y-3">{items.map((event) => <article key={event.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.08] bg-[#111923] p-4">
      <Link href={`/recordings/${event.recording_id}?t=${event.timestamp_seconds}`} aria-label={`Open ${event.original_filename} at ${event.timestamp_seconds.toFixed(1)} seconds`}><Image unoptimized width={128} height={80} src={`${API}${event.evidence_url}`} alt="Annotated person detection evidence" className="h-20 w-32 rounded object-cover"/></Link>
      <div className="min-w-48 flex-1"><p className="text-sm font-medium text-white">{event.detection_type} · {event.original_filename}</p><p className="mt-1 text-xs text-slate-400">{event.timestamp_seconds.toFixed(2)} seconds · {(event.confidence * 100).toFixed(1)}% confidence</p><p className="mt-1 text-[11px] text-slate-500">Box: x {event.bbox_x}, y {event.bbox_y}, {event.bbox_width} × {event.bbox_height}px</p><p className="mt-1 text-[10px] text-slate-600">Analysis {event.analysis_id}</p></div>
      <Link className="text-xs text-cyan-300" href={`/recordings/${event.recording_id}?t=${event.timestamp_seconds}`}>Open recording →</Link>
      <a className="text-xs text-slate-300" href={`${API}${event.evidence_url}`} download>Download evidence</a>
    </article>)}</div>}
  </div></main>;
}
