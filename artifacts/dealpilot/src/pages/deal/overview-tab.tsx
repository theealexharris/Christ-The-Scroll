import { WORKFLOW_STEPS } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, CircleDashed, Clock, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AiModeBadge, Disclaimer, useMeta, WorkflowStatusBadge } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { DealDetail, WorkflowRun, WorkflowStep } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { KeyMetrics, WarningList } from "./metrics";

const stepIcon = (s: WorkflowStep) => {
  switch (s.status) {
    case "completed":
      return <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />;
    case "running":
      return <Loader2 className="size-5 animate-spin text-sky-600" aria-hidden />;
    case "failed":
      return <XCircle className="size-5 text-red-600" aria-hidden />;
    case "waiting":
      return <Clock className="size-5 text-violet-600" aria-hidden />;
    case "skipped":
      return <CircleDashed className="size-5 text-slate-400" aria-hidden />;
    default:
      return <Circle className="size-5 text-slate-300" aria-hidden />;
  }
};

function StepDetail({ step }: { step: WorkflowStep }) {
  const out = (step.output ?? {}) as Record<string, unknown>;
  if (step.error) return <p className="text-xs text-red-700">{step.error}</p>;
  if (step.key === "validate_inputs" && Array.isArray(out.missing))
    return (
      <ul className="list-disc pl-4 text-xs text-amber-900">
        {(out.missing as { message: string }[]).map((m) => (
          <li key={m.message}>{m.message}</li>
        ))}
      </ul>
    );
  if (step.key === "gather_sources" && typeof out.note === "string") return <p className="text-xs text-slate-600">{out.note}</p>;
  if (step.key === "ai_explanation" && out.mode) return <p className="text-xs text-slate-600">{out.mode === "live" ? `Live AI (${String(out.model)})` : "Demo mode — deterministic template, not live AI"}</p>;
  if (step.key === "flag_missing_evidence" && typeof out.count === "number") return <p className="text-xs text-slate-600">{out.count} item(s) missing or unverified</p>;
  if (step.key === "create_tasks" && typeof out.added === "number") return <p className="text-xs text-slate-600">{out.added} new task(s) added</p>;
  if (step.key === "present_review" && step.status === "waiting") return <p className="text-xs text-violet-800">Waiting for you to review and approve.</p>;
  if (step.key === "save_report" && typeof out.title === "string") return <p className="text-xs text-slate-600">Saved “{out.title}”</p>;
  return null;
}

export function WorkflowPanel({ dealId, onNavigate }: { dealId: string; onNavigate: (tab: string) => void }) {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const runs = useQuery({ queryKey: ["workflow-runs", dealId], queryFn: () => api.get<{ items: WorkflowRun[] }>(`/api/deals/${dealId}/workflow-runs`) });
  const latest = runs.data?.items[0];
  const refresh = () => {
    for (const k of [["workflow-runs", dealId], ["tasks", dealId], ["ai-messages", dealId], ["documents", dealId], ["deal-activity", dealId], ["dashboard"]]) qc.invalidateQueries({ queryKey: k });
  };
  const start = useMutation({
    mutationFn: () => api.post<WorkflowRun>(`/api/deals/${dealId}/analyze`),
    onSuccess: (run) => {
      refresh();
      if (run.status === "needs_review") toast.success("Analysis ready for your review");
      else if (run.status === "needs_input") toast.warning("Some required inputs are missing");
      else if (run.status === "failed") toast.error(run.error ?? "Analysis failed");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const retry = useMutation({
    mutationFn: (runId: string) => api.post<WorkflowRun>(`/api/workflow-runs/${runId}/retry`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const approve = useMutation({
    mutationFn: (runId: string) => api.post<WorkflowRun>(`/api/workflow-runs/${runId}/approve`),
    onSuccess: (run) => {
      refresh();
      if (run.status === "completed") toast.success("Report saved to Reports");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const busy = start.isPending || retry.isPending || approve.isPending;

  return (
    <Card>
      <CardHeader
        title="Analysis workflow"
        description="Validates inputs, runs the calculation engine, generates an AI explanation, flags missing evidence and builds a checklist — then waits for your review."
        actions={
          <>
            {meta && <AiModeBadge mode={meta.aiMode} model={meta.aiModel} />}
            <Button onClick={() => start.mutate()} loading={start.isPending} disabled={busy}>
              <Play /> {latest ? "Run again" : "Run analysis"}
            </Button>
          </>
        }
      />
      <CardBody>
        {!latest ? (
          <p className="text-sm text-slate-600">No analysis has been run yet. Review the underwriting assumptions first, then run the workflow.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <WorkflowStatusBadge status={latest.status} />
              <span className="text-slate-500">
                Started {formatDateTime(latest.startedAt ?? latest.createdAt)}
                {latest.attempts > 1 && ` · attempt ${latest.attempts}`}
              </span>
            </div>
            {latest.status === "needs_input" && (
              <Callout tone="warning" title="Needs input">
                Fix the required fields on the Underwriting tab, then retry.
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onNavigate("underwriting")}>
                    Open underwriting
                  </Button>
                  <Button size="sm" onClick={() => retry.mutate(latest.id)} loading={retry.isPending}>
                    <RotateCcw /> Retry
                  </Button>
                </div>
              </Callout>
            )}
            {latest.status === "failed" && (
              <Callout tone="error" title="Analysis failed">
                {latest.error}
                <div className="mt-2">
                  <Button size="sm" onClick={() => retry.mutate(latest.id)} loading={retry.isPending}>
                    <RotateCcw /> Retry from failed step
                  </Button>
                </div>
              </Callout>
            )}
            {latest.status === "needs_review" && (
              <Callout tone="info" title="Ready for your review">
                Check the AI analyst's explanation and the generated due-diligence tasks. Approving saves a report snapshot; it doesn't send anything to anyone.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onNavigate("analyst")}>
                    Review AI explanation
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onNavigate("tasks")}>
                    Review tasks
                  </Button>
                  <Button size="sm" onClick={() => approve.mutate(latest.id)} loading={approve.isPending}>
                    <CheckCircle2 /> Approve & save report
                  </Button>
                </div>
              </Callout>
            )}
            <ol className="space-y-3" aria-label="Workflow steps">
              {WORKFLOW_STEPS.map((def) => {
                const step = latest.steps.find((s) => s.key === def.key);
                if (!step) return null;
                return (
                  <li key={def.key} className="flex gap-3">
                    <span className="mt-0.5">{stepIcon(step)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {def.label} <span className="sr-only">— {step.status}</span>
                      </p>
                      <StepDetail step={step} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function OverviewTab({ detail, onNavigate }: { detail: DealDetail; onNavigate: (tab: string) => void }) {
  const u = detail.underwriting;
  return (
    <div className="space-y-6">
      <KeyMetrics u={u} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <WorkflowPanel dealId={detail.deal.id} onNavigate={onNavigate} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Missing or unverified evidence"
              actions={
                <Button size="sm" variant="ghost" onClick={() => onNavigate("underwriting")}>
                  Update evidence
                </Button>
              }
            />
            <CardBody>
              {detail.evidenceGaps.length === 0 ? (
                <p className="text-sm text-emerald-700">All tracked evidence is recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.evidenceGaps.map((g) => (
                    <li key={g.key} className="text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone={g.priority === "high" ? "red" : g.priority === "medium" ? "amber" : "slate"}>{g.priority}</Badge>
                        <span className="font-medium text-slate-900">{g.item}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{g.whyItMatters}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Calculation warnings" />
            <CardBody>
              <WarningList warnings={u.warnings} />
            </CardBody>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
