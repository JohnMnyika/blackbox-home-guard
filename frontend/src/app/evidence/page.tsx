"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Loader2, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Evidence = { id:string; recording_id:string; analysis_id:string; original_filename:string; timestamp_seconds:number; confidence:number; detections_in_frame:number; evidence_url:string };

export default function EvidencePage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [selected, setSelected] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch(`${API}/api/v1/evidence?limit=500`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load evidence images.");
        if (!cancelled) setItems(data.evidence ?? []);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Backend connection failed."); }
      finally { if (!cancelled) setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  return <main className="min-h-screen bg-[#090e15] p-5 text-slate-200 md:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/" className="text-xs text-cyan-300">← Overview</Link>
    <h1 className="mt-4 text-2xl font-semibold text-white">Evidence vault</h1>
    <p className="mt-2 text-sm text-slate-400">Annotated local images linked to actual person detections and source recordings.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-300">{error}</p>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan-400"/></div> : !items.length && !error ? <p className="mt-6 rounded-xl border border-white/10 bg-[#111923] p-6 text-sm text-slate-400">No evidence images have been indexed.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((event) => <article key={event.id} className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#111923]">
      <button type="button" onClick={() => setSelected(event)} aria-label={`View larger evidence image for ${event.original_filename}`} className="block w-full cursor-zoom-in"><Image unoptimized width={640} height={360} src={`${API}${event.evidence_url}`} alt={`Person detection at ${event.timestamp_seconds.toFixed(1)} seconds in ${event.original_filename}`} className="aspect-video w-full object-cover"/></button>
      <div className="p-4"><p className="truncate text-sm font-medium text-white">{event.original_filename}</p><p className="mt-1 text-xs text-slate-400">{event.timestamp_seconds.toFixed(1)}s · {event.detections_in_frame} person{event.detections_in_frame === 1 ? "" : "s"} · up to {(event.confidence * 100).toFixed(1)}% confidence</p><p className="mt-1 text-[10px] text-slate-600">Analysis {event.analysis_id}</p><div className="mt-3 flex justify-between text-xs"><Link className="text-cyan-300" href={`/recordings/${event.recording_id}?t=${event.timestamp_seconds}`}>Open recording</Link><a className="text-slate-300" href={`${API}${event.evidence_url}`} download>Download image</a></div></div>
    </article>)}</div>}
  </div>
  {selected && <div role="dialog" aria-modal="true" aria-label="Evidence image viewer" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelected(null)}><div className="w-full max-w-6xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-white">{selected.original_filename}</p><p className="mt-1 text-xs text-slate-400">{selected.timestamp_seconds.toFixed(2)}s · {selected.detections_in_frame} detected persons · up to {(selected.confidence * 100).toFixed(1)}% confidence</p></div><button onClick={() => setSelected(null)} aria-label="Close image viewer" className="rounded-lg border border-white/15 p-2 text-white hover:bg-white/10"><X size={18}/></button></div><Image unoptimized width={1920} height={1080} src={`${API}${selected.evidence_url}`} alt={`Large evidence image from ${selected.original_filename}`} className="mx-auto max-h-[78vh] w-auto max-w-full rounded-lg object-contain"/><div className="mt-3 flex justify-end gap-4 text-xs"><Link className="inline-flex items-center gap-1 text-cyan-300" href={`/recordings/${selected.recording_id}?t=${selected.timestamp_seconds}`}>Open source recording <ExternalLink size={13}/></Link><a className="text-slate-300" href={`${API}${selected.evidence_url}`} download>Download evidence</a></div></div></div>}
  </main>;
}
