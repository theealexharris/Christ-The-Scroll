import { BRAND, DEAL_STAGES, labelFor, SOURCE_STATUSES, WORKFLOW_STATUS_LABELS, type WorkflowStatus } from "@workspace/dealpilot-core";
import { useQuery } from "@tanstack/react-query";
import { Bot, Database, FlaskConical, PenLine, Radio, ShieldAlert, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { Meta } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge, type BadgeTone } from "./ui/primitives";

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta"), staleTime: 5 * 60_000 });
}

const sourceTone: Record<string, { tone: BadgeTone; Icon: typeof Database }> = {
  live_provider: { tone: "green", Icon: Radio },
  user_imported: { tone: "sky", Icon: Upload },
  manual_entry: { tone: "navy", Icon: PenLine },
  demo: { tone: "amber", Icon: FlaskConical },
};

/** Where a record came from. Never implies an official feed. */
export function SourceBadge({ status, retrievedAt, className }: { status: string; retrievedAt?: string | null; className?: string }) {
  const { tone, Icon } = sourceTone[status] ?? { tone: "slate" as const, Icon: Database };
  return (
    <Badge tone={tone} className={className} title={retrievedAt ? `Captured ${formatDateTime(retrievedAt)}` : undefined}>
      <Icon className="size-3" aria-hidden />
      {labelFor(SOURCE_STATUSES, status)}
    </Badge>
  );
}

export function SampleLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900", className)}>
      {BRAND.sampleLabel}
    </span>
  );
}

export function SampleBanner() {
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong>{BRAND.sampleLabel}.</strong> This property is fictional and exists only to demonstrate the workflow. Addresses, prices and rents are invented.
      </p>
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
      <span>{BRAND.disclaimer}</span>
    </p>
  );
}

export function AiModeBadge({ mode, model }: { mode: "demo" | "live" | string; model?: string | null }) {
  return mode === "live" ? (
    <Badge tone="green">
      <Bot className="size-3" aria-hidden /> Live AI{model ? ` · ${model}` : ""}
    </Badge>
  ) : (
    <Badge tone="amber" title="No AI provider is configured. Responses are deterministic templates built from your numbers.">
      <Bot className="size-3" aria-hidden /> Demo mode — not live AI
    </Badge>
  );
}

const workflowTone: Record<WorkflowStatus, BadgeTone> = {
  queued: "slate",
  running: "sky",
  needs_input: "amber",
  needs_review: "violet",
  completed: "green",
  failed: "red",
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  return <Badge tone={workflowTone[status] ?? "slate"}>{WORKFLOW_STATUS_LABELS[status] ?? status}</Badge>;
}

export function StageBadge({ stage }: { stage: string }) {
  const tone: BadgeTone = stage === "closed" ? "green" : stage === "passed" ? "slate" : stage === "under_contract" ? "violet" : stage === "offer_drafted" ? "sky" : "navy";
  return <Badge tone={tone}>{labelFor(DEAL_STAGES, stage)}</Badge>;
}

export function BasisBadge({ basis }: { basis: string }) {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    calculated: { label: "Calculated", tone: "navy" },
    user_supplied: { label: "User-supplied", tone: "sky" },
    assumption: { label: "Assumption", tone: "amber" },
    unverified_hypothesis: { label: "Unverified hypothesis", tone: "red" },
  };
  const m = map[basis] ?? { label: basis, tone: "slate" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
