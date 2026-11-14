"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
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
  Search,
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
  timestamp: string;
  privacy?: {
    processing_mode: string;
    cloud_ai_required: boolean;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Live Cameras", icon: Camera, soon: true },
  { label: "Recordings", icon: Video, href: "/recordings" },
  { label: "AI Detection", icon: BrainCircuit, soon: true },
  { label: "Incident Timeline", icon: Clock3, soon: true },
  { label: "Evidence Vault", icon: Fingerprint, soon: true },
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

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/health`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("API health check failed");
        }

        const data: HealthData = await response.json();

        if (active) {
          setHealth(data);
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

  const apiOnline = health?.status === "healthy" && !apiError;
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

                if (item.soon || !item.href) {
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
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.04]">
                <Settings size={18} />
                Settings
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400 hover:bg-white/[0.04]">
                <CircleHelp size={18} />
                Documentation
              </button>
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
              BLACKBOX HOME GUARD v0.1.0
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

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 sm:flex">
                <Search size={14} />
                <span>Search workspace</span>
                <span className="ml-4 rounded border border-white/10 px-1.5 py-0.5 text-[10px]">
                  /
                </span>
              </div>
              <button
                className="rounded-lg border border-white/[0.07] p-2.5 text-slate-400 hover:bg-white/[0.05]"
                aria-label="Notifications"
              >
                <Bell size={17} />
              </button>
              <div className="hidden items-center gap-2 border-l border-white/[0.07] pl-4 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-300">
                  BG
                </div>
                <ChevronDown size={14} className="text-slate-500" />
              </div>
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
                    apiOnline
                      ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-400"
                      : "border-red-400/20 bg-red-400/[0.07] text-red-400"
                  }`}
                >
                  <StatusDot online={apiOnline} />
                  {apiOnline ? "All systems operational" : "API unavailable"}
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
                      Not configured
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

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Connected cameras"
                  value="0"
                  description="No cameras registered yet"
                  icon={Camera}
                />
                <MetricCard
                  title="Recorded incidents"
                  value="0"
                  description="No incidents recorded yet"
                  icon={AlertTriangle}
                />
                <MetricCard
                  title="Processed recordings"
                  value="0"
                  description="Awaiting first video import"
                  icon={Video}
                />
                <MetricCard
                  title="Evidence files"
                  value="0"
                  description="No evidence indexed yet"
                  icon={Fingerprint}
                />
              </div>
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

                <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
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
                </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={17} className="text-amber-400" />
                      <span className="text-xs text-slate-300">
                        AI processing
                      </span>
                    </div>
                    <span className="text-xs text-amber-400">Pending</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Video size={17} className="text-amber-400" />
                      <span className="text-xs text-slate-300">
                        Video pipeline
                      </span>
                    </div>
                    <span className="text-xs text-amber-400">Pending</span>
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
