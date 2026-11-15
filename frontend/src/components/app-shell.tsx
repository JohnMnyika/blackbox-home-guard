"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, Camera, ChevronLeft, ChevronRight, Clock3, Fingerprint,
  LayoutDashboard, Menu, Settings, Shield, Video, X, BrainCircuit,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type NavigationItem = { label: string; href: string; icon: LucideIcon };
const primaryLinks: NavigationItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Recordings", href: "/recordings", icon: Video },
  { label: "AI Detection", href: "/ai-detection", icon: BrainCircuit },
  { label: "Incident Timeline", href: "/detections", icon: Clock3 },
  { label: "Evidence Vault", href: "/evidence", icon: Fingerprint },
];
const systemLinks: NavigationItem[] = [
  { label: "System Health", href: "/health", icon: Activity },
  { label: "Camera Sources", href: "/cameras", icon: Camera },
  { label: "Settings", href: "/settings", icon: Settings },
];

type Runtime = { status?: string; database?: string; ai_engine?: string; video_engine?: string };

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${API}/api/v1/health`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unavailable");
        const health = await response.json();
        if (alive) setRuntime(health);
      } catch {
        if (alive) setRuntime(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const online = runtime?.status === "healthy";
  const sidebarClass = `fixed inset-y-0 left-0 z-40 flex ${collapsed ? "w-[76px]" : "w-[250px]"} flex-col border-r border-[#25334a] bg-[#0d1524] transition-all duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`;

  function renderLinks(items: NavigationItem[]) {
    return items.map((item) => {
      const active = pathname === item.href || item.href === "/recordings" && pathname.startsWith("/recordings/");
      return <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition ${active ? "bg-blue-500/10 text-blue-200" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"}`}>
        {active && <span className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r bg-blue-400"/>}<item.icon size={16} className={`shrink-0 ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`}/>{!collapsed && <span>{item.label}</span>}
      </Link>;
    });
  }

  return (
    <div className="min-h-screen bg-[#080d17] text-slate-200 lg:flex">
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={sidebarClass}>
        <div className={`flex h-[72px] items-center border-b border-[#25334a] ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/25 bg-blue-500/10"><Shield size={19} className="text-cyan-300" /></span>
            {!collapsed && <span className="min-w-0"><span className="block text-xs font-bold tracking-[0.12em] text-white">BLACKBOX</span><span className="mt-0.5 block text-[9px] tracking-[0.22em] text-cyan-400">HOME GUARD <span className="text-slate-600">· LOCAL SOC</span></span></span>}
          </Link>
          <button aria-label="Close menu" className="text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="px-3 py-5">
          <nav className="space-y-1" aria-label="Main navigation">
            {!collapsed && <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</p>}
            {renderLinks(primaryLinks)}
            <div className="my-4 border-t border-[#25334a]" />
            {!collapsed && <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">System</p>}
            {renderLinks(systemLinks)}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/[0.07] p-3">
          <div className={`rounded-lg border border-[#25334a] bg-[#111c2e] ${collapsed ? "p-2 text-center" : "p-3"}`}>
            <span className={`inline-flex items-center gap-2 text-[10px] ${online ? "text-emerald-300" : "text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-600"}`} />{collapsed ? "" : online ? "System operational" : runtime ? "System degraded" : "Backend unavailable"}</span>
            {!collapsed && <div className="mt-2 space-y-1 text-[9px] text-slate-500"><p>OpenVINO · {runtime?.ai_engine ?? "Unknown"}</p><p>FFmpeg · {runtime?.video_engine ?? "Unknown"}</p></div>}
          </div>
          <button onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="mt-2 hidden w-full items-center justify-center rounded-lg py-2 text-slate-600 hover:bg-white/[0.04] hover:text-slate-300 lg:flex">{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
        </div>
      </aside>
      <div className={`min-w-0 flex-1 transition-[margin] duration-200 ${collapsed ? "lg:ml-[76px]" : "lg:ml-[248px]"}`}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#25334a] bg-[#080d17]/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3"><button aria-label="Open navigation" className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><p className="text-[10px] text-slate-600">Workspace / <span className="text-slate-400">{title}</span></p><h1 className="mt-0.5 text-sm font-semibold text-white">{title}</h1></div></div>
          <div className="flex items-center gap-2.5">{runtime && <span className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] sm:inline-flex ${runtime.ai_engine === "available" ? "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-200" : "border-amber-400/15 bg-amber-400/[0.04] text-amber-200"}`}><BrainCircuit size={12}/>{runtime.ai_engine === "available" ? "OpenVINO ready" : "AI unavailable"}</span>}<span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] ${online ? "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-200" : "border-[#25334a] bg-white/[0.02] text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-slate-600"}`} />{online ? "Backend online" : runtime ? "Degraded" : "Backend offline"}</span></div>
        </header>
        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>
    </div>
  );
}
