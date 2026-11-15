"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CircleHelp,
  Clock3,
  Database,
  FileSearch,
  Fingerprint,
  HardDrive,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Video,
  Wifi,
  X,
  BrainCircuit,
} from "lucide-react";

type HealthData = {
  status: string;
  application: string;
  version: string;
  database: string;
  ai_engine?: string;
  video_engine?: string;
  timestamp: string;
  privacy?: {
    processing_mode: string;
    cloud_ai_required: boolean;
  };
};
type DashboardData = {
  recordings: number; processed_recordings: number; detections: number;
  evidence_images: number; cameras: number | null;
  recent_recordings: { id: string; original_filename: string; created_at: string; file_size: number }[];
  recent_detections: { id: string; recording_id: string; timestamp_seconds: number; confidence: number; original_filename: string }[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Cameras", icon: Camera, href: "/cameras" },
  { label: "Recordings", icon: Video, href: "/recordings" },
  { label: "Detection Timeline", icon: Clock3, href: "/detections" },
  { label: "Evidence Vault", icon: Fingerprint, href: "/evidence" },
];

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        online ? "bg-emerald-400" : "bg-red-400"
      }`}
    />
  );
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Camera;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#111923] p-5 transition hover:border-cyan-400/30">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{title}</p>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] p-2">
          <Icon size={18} className="text-cyan-400" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function Home() {
  const pathname = usePathname();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [apiError, setApiError] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [systemInfo, setSystemInfo] = useState<{ai_engine:string;video_engine:string;storage:{used_bytes:number;free_bytes:number};cameras:string} | null>(null);

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const [response, summaryResponse, infoResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/health`, {
          cache: "no-store",
          }),
          fetch(`${API_URL}/api/v1/dashboard`, { cache: "no-store" }),
          fetch(`${API_URL}/api/v1/system/info`, { cache: "no-store" }),
        ]);

        if (!response.ok) {
          throw new Error("API health check failed");
        }

        const data: HealthData = await response.json();
        if (!summaryResponse.ok || !infoResponse.ok) throw new Error("System details unavailable");

        if (active) {
          setHealth(data);
          setDashboard(await summaryResponse.json());
          setSystemInfo(await infoResponse.json());
          setApiError(false);
          setLastChecked(new Date());
        }
      } catch {
        if (active) {
          setApiError(true);
          setHealth(null);
          setLastChecked(new Date());
        }
      }
    };

    checkHealth();
    const interval = window.setInterval(checkHealth, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const apiOnline = !!health && !apiError;
  const systemOperational = health?.status === "healthy" && !apiError;
  const databaseOnline = health?.database === "connected";

  return (
    <main className="min-h-screen bg-[#090e15] text-slate-200">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#0c131d] transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileMenu ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-20 items-center justify-between border-b border-white/[0.07] px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2">
                <Shield className="text-cyan-400" size={24} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wide text-white">
                  BLACKBOX
                </h1>
                <p className="text-[10px] tracking-[0.2em] text-cyan-400">
                  HOME GUARD
                </p>
              </div>
            </div>
            <button
              className="text-slate-400 lg:hidden"
              onClick={() => setMobileMenu(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Security workspace
            </p>

            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = item.href === pathname;

                if (!item.href) {
                  return (
                    <button
                      key={item.label}
                      disabled
                      className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-500 opacity-60"
                    >
                      <item.icon size={18} />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-600">
                        Soon
                      </span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenu(false)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "border border-cyan-400/15 bg-cyan-400/[0.09] text-cyan-300"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <p className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              System
            </p>

            <nav className="space-y-1">
              <Link href="/settings" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.04]">
                <Settings size={18} />
                Settings
              </Link>
              <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.04]">
                <CircleHelp size={18} />
                API documentation
              </a>
            </nav>
          </div>

          <div className="mt-auto border-t border-white/[0.07] p-4">
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <LockKeyhole size={14} />
                Local-first architecture
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Designed to keep your surveillance data under your control.
              </p>
            </div>
            <p className="mt-4 text-center text-[10px] text-slate-600">
              BLACKBOX HOME GUARD v0.2.0
            </p>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-white/[0.07] bg-[#0c131d]/80 px-5 md:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenu(true)}
                className="text-slate-400 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <div>
                <p className="text-xs text-slate-500">Workspace / Overview</p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Security Overview
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2 text-xs text-emerald-300 sm:flex">
              <LockKeyhole size={14} /> Local processing
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
            {/* Welcome */}
            <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
                    Security intelligence platform
                  </p>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Your security command center.
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-400">
                  Monitor your local surveillance infrastructure, review
                  activity and manage digital evidence.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#111923] px-3 py-2.5 text-xs text-slate-400">
                <Radio size={15} className="text-cyan-400" />
                Development environment
              </div>
            </section>

            {/* System status */}
            <section className="rounded-xl border border-white/[0.07] bg-[#111923] p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity size={17} className="text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white">
                      System health
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Live connection to your local backend
                  </p>
                </div>
                <div
                  className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                    systemOperational
                      ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-400"
                      : apiOnline
                        ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"
                        : "border-red-400/20 bg-red-400/[0.07] text-red-400"
                  }`}
                >
                  <StatusDot online={systemOperational} />
                  {systemOperational ? "All systems operational" : apiOnline ? "System degraded" : "API unavailable"}
                </div>
              </div>

              <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/[0.04] p-2.5">
                    <Wifi size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Backend API</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-white">
                      <StatusDot online={apiOnline} />
                      {apiOnline ? "Connected" : "Disconnected"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/[0.04] p-2.5">
                    <Database size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">SQLite database</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-white">
                      <StatusDot online={databaseOnline} />
                      {databaseOnline ? "Connected" : "Unavailable"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/[0.04] p-2.5">
                    <BrainCircuit size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">AI inference engine</p>
                    <p className="mt-1 text-sm font-medium text-amber-400">
                      {systemInfo?.ai_engine ?? "Checking"}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[10px] text-slate-600">
                {lastChecked
                  ? `Last checked: ${lastChecked.toLocaleTimeString()} · Refreshes every 10 seconds`
                  : "Checking backend connection..."}
              </p>
            </section>

            {/* Metrics */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Surveillance summary
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-600">
                  Live metrics
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                <MetricCard
                  title="Connected cameras"
                  value={dashboard ? String(dashboard.cameras ?? 0) : "—"}
                  description="Saved configurations · not connected"
                  icon={Camera}
                />
                <MetricCard
                  title="Person detections"
                  value={dashboard ? String(dashboard.detections) : "—"}
                  description="Person detections from local analysis"
                  icon={AlertTriangle}
                />
                <MetricCard
                  title="Total recordings"
                  value={dashboard ? String(dashboard.recordings) : "—"}
                  description="Recordings in the local library"
                  icon={Video}
                />
                <MetricCard
                  title="Processed recordings"
                  value={dashboard ? String(dashboard.processed_recordings) : "—"}
                  description="Successfully processed recordings"
                  icon={Video}
                />
                <MetricCard
                  title="Evidence files"
                  value={dashboard ? String(dashboard.evidence_images) : "—"}
                  description="Unique annotated evidence images"
                  icon={Fingerprint}
                />
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.07] bg-[#111923]">
              <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
                <div><h3 className="text-sm font-semibold text-white">Recent recordings</h3><p className="mt-1 text-xs text-slate-500">Latest uploads in local storage</p></div>
                <Link href="/recordings" className="text-xs text-cyan-300 hover:text-cyan-200">View library →</Link>
              </div>
              {dashboard?.recent_recordings.length ? <div className="divide-y divide-white/[0.06]">
                {dashboard.recent_recordings.map((recording) => <Link key={recording.id} href={`/recordings/${recording.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.025]">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{recording.original_filename}</p><p className="mt-1 text-xs text-slate-500">{new Date(recording.created_at).toLocaleString()}</p></div>
                  <span className="text-xs text-slate-400">{(recording.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                </Link>)}
              </div> : <p className="p-5 text-xs text-slate-500">{apiOnline ? "No recordings uploaded yet." : "Recent recordings are unavailable while the API is offline."}</p>}
            </section>

            {/* Activity and storage */}
            <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-white/[0.07] bg-[#111923]">
                <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Recent security activity
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Latest events from your surveillance system
                    </p>
                  </div>
                  <Clock3 size={17} className="text-slate-500" />
                </div>

                {dashboard?.recent_detections.length ? <div className="divide-y divide-white/[0.06]">
                  {dashboard.recent_detections.map((item) => <Link key={item.id} href={`/recordings/${item.recording_id}?t=${item.timestamp_seconds}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.025]">
                    <div><p className="text-sm text-white">Person detected · {item.original_filename}</p><p className="mt-1 text-xs text-slate-500">{item.timestamp_seconds.toFixed(1)}s · {(item.confidence * 100).toFixed(1)}% confidence</p></div><span className="text-xs text-cyan-300">Review</span>
                  </Link>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <FileSearch size={28} className="text-slate-500" />
                  </div>
                  <h4 className="mt-4 text-sm font-medium text-slate-300">
                    No security activity yet
                  </h4>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">
                    Once you import surveillance footage and configure
                    detection, events will appear here.
                  </p>
                </div>}
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-[#111923]">
                <div className="border-b border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-white">
                    Infrastructure
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Core application components
                  </p>
                </div>

                <div className="space-y-5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database size={17} className="text-cyan-400" />
                      <span className="text-xs text-slate-300">
                        Database engine
                      </span>
                    </div>
                    <span className="text-xs text-emerald-400">
                      {databaseOnline ? "Healthy" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HardDrive size={17} className="text-cyan-400" />
                      <span className="text-xs text-slate-300">
                        Storage engine
                      </span>
                    </div>
                    <span className="text-xs text-emerald-400">SQLite</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <HardDrive size={17} className="text-cyan-400" />
                      <span className="text-xs text-slate-300">Storage utilization</span>
                    </div>
                    <span className="text-right text-xs text-slate-400">{systemInfo ? `${formatBytes(systemInfo.storage.used_bytes)} used · ${formatBytes(systemInfo.storage.free_bytes)} free` : "Checking"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={17} className="text-amber-400" />
                      <span className="text-xs text-slate-300">
                        AI processing
                      </span>
                    </div>
                    <span className="text-xs text-amber-400">{systemInfo?.ai_engine ?? "Checking"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Video size={17} className="text-amber-400" />
                      <span className="text-xs text-slate-300">
                        Video pipeline
                      </span>
                    </div>
                    <span className="text-xs text-amber-400">{systemInfo?.video_engine ?? "Checking"}</span>
                  </div>

                  <div className="border-t border-white/[0.06] pt-5">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <ShieldCheck size={16} />
                      Local processing configured
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      Cloud AI is not required by the current application
                      configuration. Network isolation has not yet been
                      independently verified.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <footer className="flex flex-col justify-between gap-2 border-t border-white/[0.06] pt-5 text-[10px] text-slate-600 sm:flex-row">
              <p>BLACKBOX HOME GUARD · LOCAL SECURITY INTELLIGENCE</p>
              <p>Version 0.1.0 · Development build</p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
