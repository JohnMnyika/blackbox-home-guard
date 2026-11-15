"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2,
  Clock3, Database, FileVideo2, Fingerprint, HardDrive, RefreshCw,
  ShieldCheck, Video, Wifi, Workflow,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingState, MetricCard, PanelHeader, StatusPill } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Health = { status:string; database:string; ai_engine:string; video_engine:string; video_processing:string; timestamp:string; version:string };
type SystemInfo = { ai_engine:string; model:string; video_engine:string; video_processing:string; storage:{used_bytes:number;free_bytes:number} };
type Recording = { id:string; original_filename:string; file_size:number; duration:number|null; frame_count:number; status:string; analysis_status:string|null; detection_count:number; created_at:string; thumbnail_url:string|null };
type Detection = { id:string; recording_id:string; original_filename:string; timestamp_seconds:number; confidence:number; detection_type:string; evidence_url:string };
type Analysis = { id:string; recording_id:string; original_filename:string; status:string; progress_percent:number; analyzed_frames:number|null; total_detections:number; created_at:string; completed_at:string|null };
type ActivityPoint = { date:string; detections:number; recordings:number };
type Dashboard = { recordings:number; processed_recordings:number; analyzed_recordings:number; detections:number; persons_detected:number; analysis_runs:number; active_analyses:number; evidence_images:number; recent_recordings:Recording[]; recent_detections:Detection[]; recent_analyses:Analysis[]; activity:ActivityPoint[] };

function formatBytes(bytes:number) { const units=["B","KB","MB","GB","TB"];let value=bytes,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++;}return `${value.toFixed(index>1?1:0)} ${units[index]}`; }
function formatDuration(seconds:number|null) { if(seconds===null||!Number.isFinite(seconds))return "Unknown duration";const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=Math.floor(seconds%60);return h?`${h}h ${m}m`:`${m}m ${s}s`; }
function formatTimestamp(seconds:number) { const value=Math.max(0,Math.floor(seconds));return `${Math.floor(value/60).toString().padStart(2,"0")}:${(value%60).toString().padStart(2,"0")}`; }

function ActivityChart({points}:{points:ActivityPoint[]}) {
  const maximum=Math.max(1,...points.map((point)=>point.detections));
  const coordinates=points.map((point,index)=>({ ...point,x:points.length<2?350:28+index*(644/(points.length-1)),y:126-(point.detections/maximum)*96 }));
  const line=coordinates.map((point)=>`${point.x},${point.y}`).join(" ");
  const area=coordinates.length?`28,126 ${line} 672,126`:"";
  return <div className="px-4 pb-4 pt-3 sm:px-5">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-300"/>Person detections</span><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-blue-500"/>Recording uploads</span><span className="ml-auto text-slate-600">UTC dates</span></div>
    <svg viewBox="0 0 700 153" role="img" aria-label="Real detection and upload activity for the past seven days" className="mt-3 h-36 w-full overflow-visible">
      {[28,76,126].map((y)=><line key={y} x1="28" x2="672" y1={y} y2={y} stroke="#25334a" strokeDasharray="4 6"/>)}
      <polygon points={area} fill="url(#activity-fill)"/><defs><linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".17"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>
      {coordinates.map((point)=><rect key={`bar-${point.date}`} x={point.x-7} y={126-Math.min(34,point.recordings*9)} width="14" height={Math.min(34,point.recordings*9)} rx="3" fill="#3b82f6" opacity=".72"/>)}
      {coordinates.length>0&&<polyline points={line} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>}
      {coordinates.map((point)=><g key={point.date}><circle cx={point.x} cy={point.y} r="3" fill="#111c2e" stroke="#67e8f9" strokeWidth="2"/><text x={point.x} y="148" textAnchor="middle" fill="#71829a" fontSize="9">{point.date.slice(5)}</text></g>)}
    </svg>
    {!points.some((point)=>point.detections||point.recordings)&&<p className="text-center text-[10px] text-slate-600">No activity recorded during this period.</p>}
  </div>;
}

function HealthRow({label,value,good,icon:Icon}:{label:string;value:string;good:boolean|null;icon:typeof Wifi}) {
  const statusClass=good===true?"text-emerald-300":good===false?"text-amber-300":"text-slate-500";
  const dotClass=good===true?"bg-emerald-400":good===false?"bg-amber-400":"bg-slate-600";
  return <div className="flex items-center justify-between gap-3 py-2.5"><span className="flex min-w-0 items-center gap-2.5 text-[11px] text-slate-400"><Icon size={14} className="shrink-0 text-slate-500"/>{label}</span><span className={`flex min-w-0 items-center gap-1.5 text-right text-[10px] ${statusClass}`}><i className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}/><span className="truncate">{value}</span></span></div>;
}

export default function Home() {
  const [health,setHealth]=useState<Health|null>(null);
  const [info,setInfo]=useState<SystemInfo|null>(null);
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);

  const refresh=useCallback(async(initial=false)=>{
    if(initial)setLoading(true);else setRefreshing(true);
    try {
      const [healthResponse,dashboardResponse,infoResponse]=await Promise.all([
        fetch(`${API}/api/v1/health`,{cache:"no-store"}),
        fetch(`${API}/api/v1/dashboard`,{cache:"no-store"}),
        fetch(`${API}/api/v1/system/info`,{cache:"no-store"}),
      ]);
      if(!healthResponse.ok||!dashboardResponse.ok||!infoResponse.ok)throw new Error("One or more system endpoints returned an error.");
      const [healthData,dashboardData,infoData]=await Promise.all([healthResponse.json(),dashboardResponse.json(),infoResponse.json()]);
      setHealth(healthData);setDashboard(dashboardData);setInfo(infoData);setError("");setLastUpdated(new Date());
    } catch(cause) { setError(cause instanceof Error?cause.message:"Unable to load live dashboard data."); }
    finally { setLoading(false);setRefreshing(false); }
  },[]);

  useEffect(()=>{const start=window.setTimeout(()=>void refresh(true),0);const timer=window.setInterval(()=>void refresh(),30000);return()=>{window.clearTimeout(start);window.clearInterval(timer);};},[refresh]);

  const aiReady=info?.ai_engine.toLowerCase().includes("available")??health?.ai_engine==="available";
  const databaseReady=health?.database==="connected";
  const videoReady=info?.video_engine==="FFmpeg / FFprobe"||health?.video_engine==="available";

  return <AppShell title="Security overview"><div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 xl:p-7">
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[9px] font-semibold uppercase tracking-[.22em] text-blue-300">Local surveillance operations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Security command center</h1><p className="mt-1.5 max-w-2xl text-xs text-slate-400">Review analyzed footage, person detections and system readiness from one workspace.</p></div>
      <div className="flex items-center gap-2"><StatusPill label={health?.status=== "healthy"?"All checks healthy":health?"System degraded":"Checking system"} tone={health?.status==="healthy"?"emerald":health?"amber":"slate"}/><button onClick={()=>void refresh()} disabled={refreshing} aria-label="Refresh dashboard data" className="inline-flex items-center gap-2 rounded-lg border border-[#25334a] bg-[#111c2e] px-3 py-2 text-[10px] text-slate-300 transition hover:border-blue-400/30 hover:text-white disabled:opacity-50"><RefreshCw size={13} className={refreshing?"animate-spin":""}/>Refresh</button></div>
    </section>

    {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-xs text-red-200"><span>Live dashboard data could not be refreshed: {error}</span><a href={`${API}/api/v1/health`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Open API health</a></div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Total recordings" value={dashboard?.recordings??"—"} detail={`${dashboard?.processed_recordings??0} successfully imported`} icon={Video} tone="blue"/>
      <MetricCard title="Person detections" value={dashboard?.persons_detected??"—"} detail="Persisted local inference results" icon={BrainCircuit} tone="cyan"/>
      <MetricCard title="Detection events" value={dashboard?.detections??"—"} detail={`${dashboard?.evidence_images??0} unique annotated frames`} icon={Activity} tone="amber"/>
      <MetricCard title="Analyzed recordings" value={dashboard?.analyzed_recordings??"—"} detail={`${dashboard?.active_analyses??0} analysis jobs active`} icon={CheckCircle2} tone="emerald"/>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
      <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Detection activity" subtitle="Stored person detections and recording uploads · seven days" icon={Activity} action={<span className="rounded-md border border-[#25334a] px-2 py-1 text-[9px] text-slate-500">DAILY</span>}/>{loading&&!dashboard?<LoadingState label="Loading activity"/>:dashboard?<ActivityChart points={dashboard.activity??[]}/>:<div className="p-5 text-xs text-slate-500">Activity is unavailable.</div>}</article>
      <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="System health" subtitle="Live checks from the local host" icon={ShieldCheck} action={<Link href="/health" className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-cyan-200">Details <ArrowRight size={12}/></Link>}/>
        <div className="divide-y divide-[#25334a]/70 px-4 py-1 sm:px-5"><HealthRow label="FastAPI backend" value={health?.status??"Checking"} good={health?health.status==="healthy":null} icon={Wifi}/><HealthRow label="SQLite database" value={health?.database??"Checking"} good={health?databaseReady:null} icon={Database}/><HealthRow label="OpenVINO model" value={info?.model??health?.ai_engine??"Checking"} good={info?aiReady:health?health.ai_engine==="available":null} icon={BrainCircuit}/><HealthRow label="FFmpeg / FFprobe" value={info?.video_engine??health?.video_engine??"Checking"} good={info?videoReady:health?videoReady:null} icon={Workflow}/><HealthRow label="Local storage" value={info?`${formatBytes(info.storage.used_bytes)} used · ${formatBytes(info.storage.free_bytes)} free`:"Checking"} good={info?info.storage.free_bytes>0:null} icon={HardDrive}/></div>
        <div className="flex items-center justify-between border-t border-[#25334a] bg-[#0d1524]/60 px-4 py-3 text-[9px] text-slate-500 sm:px-5"><span>Local processing · no cloud AI</span><span>{lastUpdated?`Updated ${lastUpdated.toLocaleTimeString()}`:"Awaiting health check"}</span></div>
      </article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Recent security events" subtitle="Latest persisted person detections" icon={AlertTriangle} action={<Link href="/detections" className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-cyan-200">Timeline <ArrowRight size={12}/></Link>}/>
        {loading&&!dashboard?<LoadingState label="Loading events"/>:dashboard?.recent_detections.length?<div className="divide-y divide-[#25334a]/70">{dashboard.recent_detections.slice(0,5).map((event)=><Link key={event.id} href={`/recordings/${event.recording_id}?t=${event.timestamp_seconds}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.025] sm:px-5">
          <div className="relative h-12 w-[76px] shrink-0 overflow-hidden rounded-md border border-[#25334a] bg-[#0d1524]">{event.evidence_url?<Image unoptimized width={160} height={100} src={`${API}${event.evidence_url}`} alt="Annotated detection evidence" className="h-full w-full object-cover"/>:<Fingerprint size={17} className="m-auto mt-3 text-slate-600"/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium text-slate-100">{event.detection_type} detected · {event.original_filename}</p><p className="mt-1 text-[10px] text-slate-500">Video time {formatTimestamp(event.timestamp_seconds)} · {(event.confidence*100).toFixed(1)}% confidence</p></div><span className="hidden rounded-md border border-cyan-400/15 bg-cyan-400/[0.04] px-2 py-1 text-[9px] text-cyan-200 sm:inline">PERSON</span><ArrowRight size={13} className="text-slate-600"/>
        </Link>)}</div>:<EmptyState title="No detection events yet" description="Import a recording and run a local person analysis to build the event feed." icon={Fingerprint}/>}</article>

      <article className="surface-panel overflow-hidden rounded-xl"><PanelHeader title="Recent recordings" subtitle={`${dashboard?.recordings??0} recordings in the local library`} icon={FileVideo2} action={<Link href="/recordings" className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-cyan-200">Open library <ArrowRight size={12}/></Link>}/>
        {loading&&!dashboard?<LoadingState label="Loading recordings"/>:dashboard?.recent_recordings.length?<div className="grid gap-3 p-3 sm:grid-cols-2">{dashboard.recent_recordings.slice(0,4).map((recording)=><Link key={recording.id} href={`/recordings/${recording.id}`} className="group overflow-hidden rounded-lg border border-[#25334a] bg-[#0d1524] transition hover:border-blue-400/35">
          <div className="relative aspect-[16/8.6] overflow-hidden bg-[#09111e]">{recording.thumbnail_url?<Image unoptimized width={640} height={360} src={`${API}${recording.thumbnail_url}`} alt={`Preview frame from ${recording.original_filename}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/>:<div className="grid h-full place-items-center"><Video size={24} className="text-slate-700"/></div>}<span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-1 text-[9px] text-white">{formatDuration(recording.duration)}</span><span className="absolute left-2 top-2"><StatusPill label={recording.analysis_status??"Not analyzed"} tone={recording.analysis_status==="completed"?"emerald":recording.analysis_status==="running"||recording.analysis_status==="queued"?"cyan":recording.analysis_status==="failed"?"red":"slate"}/></span></div>
          <div className="p-3"><p className="truncate text-[11px] font-medium text-slate-100">{recording.original_filename}</p><p className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-slate-500"><span>{formatBytes(recording.file_size)} · {recording.frame_count} frames</span><span>{recording.detection_count} events</span></p></div>
        </Link>)}</div>:<EmptyState title="No recordings yet" description="Upload surveillance footage to create a searchable local video library." icon={Video}/>}</article>
    </section>

    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#25334a] pt-4 text-[9px] text-slate-600"><span>BLACKBOX HOME GUARD · LOCAL VIDEO INTELLIGENCE</span><span className="inline-flex items-center gap-1.5"><Clock3 size={11}/>{lastUpdated?`Last synced ${lastUpdated.toLocaleTimeString()}`:"Waiting for first sync"} · refreshes every 30 seconds</span></footer>
  </div></AppShell>;
}
