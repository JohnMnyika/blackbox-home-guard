import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "cyan" | "emerald" | "amber" | "red" | "slate";
const toneStyles: Record<Tone, string> = {
  blue: "border-blue-400/20 bg-blue-400/[0.08] text-blue-200",
  cyan: "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  amber: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  red: "border-red-400/20 bg-red-400/[0.08] text-red-200",
  slate: "border-slate-400/15 bg-slate-400/[0.06] text-slate-300",
};

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  const dot = tone === "emerald" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : tone === "cyan" ? "bg-cyan-400" : tone === "blue" ? "bg-blue-400" : "bg-slate-500";
  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneStyles[tone]}`}><i className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</span>;
}

export function MetricCard({ title, value, detail, icon: Icon, tone = "blue" }: {
  title: string; value: string | number; detail: string; icon: LucideIcon; tone?: Tone;
}) {
  const iconTone = tone === "emerald" ? "text-emerald-300 bg-emerald-400/10" : tone === "amber" ? "text-amber-300 bg-amber-400/10" : tone === "cyan" ? "text-cyan-300 bg-cyan-400/10" : tone === "red" ? "text-red-300 bg-red-400/10" : "text-blue-300 bg-blue-400/10";
  return <article className="surface-card group rounded-xl p-4 transition-colors hover:border-blue-400/35 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-400">{title}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{value}</p></div><span className={`rounded-lg p-2.5 ${iconTone}`}><Icon size={17}/></span></div>
    <p className="mt-2 truncate text-[10px] text-slate-500">{detail}</p>
  </article>;
}

export function PanelHeader({ title, subtitle, action, icon: Icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#25334a] px-4 py-3.5 sm:px-5">
    <div className="flex min-w-0 items-center gap-2.5">{Icon && <Icon size={16} className="shrink-0 text-cyan-300"/>}<div className="min-w-0"><h2 className="truncate text-xs font-semibold text-slate-100 sm:text-sm">{title}</h2>{subtitle && <p className="mt-1 truncate text-[10px] text-slate-500">{subtitle}</p>}</div></div>{action}
  </div>;
}

export function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center"><span className="rounded-xl border border-[#25334a] bg-white/[0.025] p-3"><Icon size={21} className="text-slate-500"/></span><p className="mt-3 text-xs font-medium text-slate-300">{title}</p><p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-500">{description}</p></div>;
}

export function LoadingState({ label = "Loading data" }: { label?: string }) {
  return <div role="status" className="grid min-h-44 place-items-center text-xs text-slate-500"><span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-cyan-300"/>{label}…</span></div>;
}
