"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Info = { application:string; version:string; environment:string; video_engine:string; video_processing:string; ai_engine:string; model:string; storage_engine:string; processing_mode:string; cameras:string; storage:{used_bytes:number;free_bytes:number} };

export default function SettingsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(`${API}/api/v1/system/info`, { cache:"no-store" }); if (!response.ok) throw new Error("Backend is unavailable"); setInfo(await response.json()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load runtime information."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const rows = info ? Object.entries({ Application:info.application, Version:info.version, Environment:info.environment, "Video engine":info.video_engine, "Video processing":info.video_processing, "AI engine":info.ai_engine, Model:info.model, Database:info.storage_engine, "Processing mode":info.processing_mode, Cameras:info.cameras, "Storage used":`${(info.storage.used_bytes/1073741824).toFixed(2)} GB`, "Storage free":`${(info.storage.free_bytes/1073741824).toFixed(2)} GB` }) : [];
  return <AppShell title="Settings"><div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 xl:p-7">
    <section><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Configuration</p><h2 className="mt-2 text-2xl font-semibold text-white">Local runtime settings</h2><p className="mt-2 text-sm text-slate-400">Runtime details are read from the local backend. This page does not change system configuration.</p></section>
    <section className="surface-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h3 className="text-sm font-semibold text-white">Runtime information</h3><p className="mt-1 text-xs text-slate-500">Application, processing and storage</p></div><button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04]"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
      {error && <p role="alert" className="m-5 rounded-md border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-300">{error}</p>}
      {loading && !info ? <p className="p-5 text-sm text-slate-500">Loading runtime details…</p> : <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label,value])=><div key={label}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-200">{value}</dd></div>)}</dl>}
    </section>
    <p className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs leading-relaxed text-amber-100/70">This local application has no user authentication. Anyone who can access the host or its network services may access its data.</p>
  </div></AppShell>;
}
