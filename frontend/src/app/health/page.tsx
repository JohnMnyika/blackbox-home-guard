"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, BrainCircuit, Database, HardDrive, RefreshCw, Video, Wifi } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Health = { status:string; database:string; ai_engine:string; video_engine:string; video_processing:string; version:string };
type Info = { ai_engine:string; model:string; video_engine:string; video_processing:string; storage:{used_bytes:number;free_bytes:number} };
type Row = { label:string; value:string; note:string; icon:typeof Activity; good:boolean|null };
function bytes(value:number) { const units=["B","KB","MB","GB","TB"]; let n=value, i=0; while(n>=1024&&i<units.length-1){n/=1024;i++;} return `${n.toFixed(i>1?1:0)} ${units[i]}`; }

export default function HealthPage() {
  const [health,setHealth]=useState<Health|null>(null); const [info,setInfo]=useState<Info|null>(null); const [error,setError]=useState(""); const [checked,setChecked]=useState<Date|null>(null); const [loading,setLoading]=useState(false);
  const refresh=useCallback(async()=>{setLoading(true);try{const [h,i]=await Promise.all([fetch(`${API}/api/v1/health`,{cache:"no-store"}),fetch(`${API}/api/v1/system/info`,{cache:"no-store"})]);if(!h.ok||!i.ok)throw new Error("The backend returned an error.");setHealth(await h.json());setInfo(await i.json());setError("");setChecked(new Date());}catch(cause){setError(cause instanceof Error?cause.message:"Backend is unavailable.");setHealth(null);}finally{setLoading(false);}},[]);
  useEffect(()=>{const initial=window.setTimeout(()=>void refresh(),0);const timer=window.setInterval(()=>void refresh(),30000);return()=>{window.clearTimeout(initial);window.clearInterval(timer);};},[refresh]);
  const rows:Row[]=[
    {label:"Backend API",value:health?(health.status==="healthy"?"Connected · healthy":"Connected · degraded"):"Unavailable",note:"FastAPI health endpoint",icon:Wifi,good:health?health.status==="healthy":null},
    {label:"SQLite database",value:health?.database??"Unknown",note:"Connection check",icon:Database,good:health?health.database==="connected":null},
    {label:"OpenVINO and model",value:info?.ai_engine??health?.ai_engine??"Unknown",note:info?.model??"Model availability",icon:BrainCircuit,good:info?info.model.toLowerCase().includes("unavailable")?false:true:null},
    {label:"FFmpeg / FFprobe",value:info?.video_engine??health?.video_engine??"Unknown",note:"Video validation and playback tools",icon:Video,good:info?info.video_engine!=="Unavailable":null},
    {label:"Video analysis",value:info?.video_processing??health?.video_processing??"Unknown",note:"Persisted background analysis jobs",icon:Activity,good:health?true:null},
    {label:"Local storage",value:info?`${bytes(info.storage.used_bytes)} used`:"Unknown",note:info?`${bytes(info.storage.free_bytes)} free on filesystem`:"Storage not reported",icon:HardDrive,good:info?info.storage.free_bytes>0:null},
  ];
  return <AppShell title="System health"><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 xl:p-7">
    <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Operations</p><h2 className="mt-2 text-2xl font-semibold text-white">System health</h2><p className="mt-2 text-sm text-slate-400">Live checks from the local API and runtime information endpoint.</p></div><div className="flex items-center gap-3">{health&&<span className={`rounded-full border px-3 py-2 text-[10px] font-medium ${health.status==="healthy"?"border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300":"border-amber-400/20 bg-amber-400/[0.05] text-amber-300"}`}>Overall · {health.status}</span>}<button onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04]"><RefreshCw size={13} className={loading?"animate-spin":""}/>Refresh status</button></div></section>
    {error&&<div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row=><article key={row.label} className="surface-panel rounded-xl p-5"><div className="flex items-start justify-between"><div className="rounded-lg border border-[#25334a] bg-[#0d1524] p-2.5"><row.icon size={17} className="text-cyan-300"/></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] ${row.good===true?"border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300":row.good===false?"border-red-400/20 bg-red-400/[0.05] text-red-300":"border-[#25334a] text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${row.good===true?"bg-emerald-400":row.good===false?"bg-red-400":"bg-slate-600"}`}/>{row.good===true?"Available":row.good===false?"Unavailable":"Unknown"}</span></div><p className="mt-5 text-xs text-slate-500">{row.label}</p><p className="mt-1 break-words text-base font-medium text-white">{row.value}</p><p className="mt-2 text-[10px] text-slate-600">{row.note}</p></article>)}</section>
    <section className="flex flex-wrap justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-slate-600"><span>Application version {health?.version??"—"} · Local processing mode</span><span>{checked?`Last checked ${checked.toLocaleTimeString()}`:"Waiting for health check"} · Refreshes every 30 seconds</span></section>
  </div></AppShell>;
}
