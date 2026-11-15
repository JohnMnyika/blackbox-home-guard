"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Radio, Plus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type CameraConfig = { id:string; name:string; source:string; camera_type:"rtsp"|"usb"; connection_status:string; created_at:string };

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [cameraType, setCameraType] = useState<"rtsp"|"usb">("rtsp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCameras = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/v1/cameras`, { cache:"no-store" });
      if (!response.ok) throw new Error("Unable to load camera configurations.");
      const data = await response.json();
      setCameras(data.cameras ?? []);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Backend connection failed."); }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadCameras); }, [loadCameras]);

  async function saveCamera(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API}/api/v1/cameras`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,source,camera_type:cameraType}) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Check the camera name and source format.");
      setName(""); setSource(""); setNotice("Configuration saved. Connectivity has not been tested."); await loadCameras();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save camera configuration."); }
    finally { setBusy(false); }
  }

  return <AppShell title="Camera sources"><main className="min-h-[calc(100vh-72px)] bg-[#080d17] p-4 text-slate-200 sm:p-6 xl:p-7"><div className="mx-auto max-w-5xl"><h2 className="text-2xl font-semibold text-white">Camera configuration</h2><p className="mt-2 text-sm text-slate-400">Save local camera source details for future integration. Saving a source does not connect to or monitor it.</p>
    <form onSubmit={saveCamera} className="surface-panel mt-6 grid gap-4 rounded-xl p-5 sm:grid-cols-2">
      <label className="text-xs text-slate-400">Camera name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Front entrance" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1119] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"/></label>
      <label className="text-xs text-slate-400">Camera type<select value={cameraType} onChange={e=>setCameraType(e.target.value as "rtsp"|"usb")} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1119] px-3 py-2.5 text-sm text-white"><option value="rtsp">RTSP source</option><option value="usb">Local USB / device</option></select></label>
      <label className="text-xs text-slate-400 sm:col-span-2">Source<input required maxLength={500} value={source} onChange={e=>setSource(e.target.value)} placeholder={cameraType === "rtsp" ? "rtsp://camera-host:554/stream" : "/dev/video0"} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1119] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"/><span className="mt-1 block text-[11px] text-slate-600">RTSP URLs with embedded credentials are rejected. Live capture is not implemented.</span></label>
      <div className="sm:col-span-2"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}Save configuration</button></div>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
    <section className="mt-7 space-y-3">{cameras.length ? cameras.map(camera=><article key={camera.id} className="surface-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"><div className="flex items-center gap-3"><Camera className="text-slate-400" size={18}/><div><h2 className="text-sm font-medium text-white">{camera.name}</h2><p className="mt-1 break-all text-xs text-slate-500">{camera.source} · {camera.camera_type.toUpperCase()}</p></div></div><span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-300"><Radio size={13}/>Not tested</span></article>) : !error ? <p className="surface-panel rounded-xl p-6 text-sm text-slate-400">No camera sources configured.</p> : null}</section>
  </div></main></AppShell>;
}
