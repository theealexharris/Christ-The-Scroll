import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-navy-950">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  navy: "bg-navy-50 text-navy-800 ring-navy-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "slate", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)} {...props} />;
}

const calloutStyles = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", Icon: Info },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", Icon: AlertTriangle },
  error: { box: "border-red-200 bg-red-50 text-red-900", Icon: XCircle },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
} as const;

export function Callout({ tone = "info", title, children, className }: { tone?: keyof typeof calloutStyles; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const { box, Icon } = calloutStyles[tone];
  return (
    <div role={tone === "error" ? "alert" : "note"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
}

export function LoadingBlock({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400 [&_svg]:size-8">{icon}</div>}
      <h3 className="text-base font-semibold text-navy-950">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <Callout tone="error" title="Couldn't load this">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </Callout>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-semibold", tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-navy-950")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
