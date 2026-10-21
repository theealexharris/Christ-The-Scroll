import type { AiAnswer, AiReview } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AiModeBadge, BasisBadge } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { AiMessage } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type MessagesResponse = { mode: "demo" | "live"; model: string | null; items: AiMessage[] };

function ReviewView({ review, msg }: { review: AiReview & { assumptionVersion?: number }; msg: AiMessage }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <AiModeBadge mode={msg.mode} model={msg.model} />
        <span>Generated {formatDateTime(msg.createdAt)}</span>
        {review.assumptionVersion !== undefined && <span>· based on assumptions v{review.assumptionVersion}</span>}
      </div>
      <section>
        <h3 className="text-sm font-semibold text-navy-950">Summary</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-800">{review.summary}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-navy-950">In plain language</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-800">{review.plainLanguageSummary}</p>
      </section>
      {review.metricExplanations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-navy-950">What the numbers mean</h3>
          <ul className="mt-2 space-y-2">
            {review.metricExplanations.map((m) => (
              <li key={m.metric} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{m.metric}</span>
                  <BasisBadge basis={m.basis} />
                </div>
                <p className="text-slate-700">{m.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="text-sm font-semibold text-navy-950">Financing comparison</h3>
        <p className="mt-1 text-sm text-slate-800">{review.financingNotes}</p>
      </section>
      {review.risks.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-navy-950">Risks</h3>
          <ul className="mt-2 space-y-2">
            {review.risks.map((r) => (
              <li key={r.title + r.detail} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "slate"}>{r.severity}</Badge>
                  <span className="font-medium text-slate-900">{r.title}</span>
                  <BasisBadge basis={r.basis} />
                </div>
                <p className="text-slate-700">{r.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {review.missingEvidence.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-navy-950">Missing evidence</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {review.missingEvidence.map((g) => (
              <li key={g.item}>
                <strong className="font-medium text-slate-900">{g.item}.</strong> {g.whyItMatters}
              </li>
            ))}
          </ul>
        </section>
      )}
      {review.checklist.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-navy-950">Suggested checklist</h3>
          <p className="text-xs text-slate-500">Running the workflow adds these to the Due diligence tab.</p>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {review.checklist.map((c) => (
              <li key={c.title}>
                <span className="text-xs text-slate-500">[{c.category}]</span> {c.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function AnalystTab({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["ai-messages", dealId], queryFn: () => api.get<MessagesResponse>(`/api/deals/${dealId}/ai-messages`) });
  const review = useMutation({
    mutationFn: () => api.post<AiMessage>(`/api/deals/${dealId}/ai-review`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-messages", dealId] }),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const ask = useMutation({
    mutationFn: (q: string) => api.post(`/api/deals/${dealId}/ai-chat`, { question: q }),
    onSuccess: () => {
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["ai-messages", dealId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock rows={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const latestReview = [...data.items].reverse().find((m) => m.kind === "review");
  const chat = data.items.filter((m) => m.kind !== "review");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (question.trim().length >= 3) ask.mutate(question.trim());
  }

  return (
    <div className="space-y-4">
      {data.mode === "demo" ? (
        <Callout tone="warning" title="Demo mode — not live AI">
          No AI provider is configured on the server, so the analyst uses deterministic templates built only from your numbers. It cannot look anything up. Configure
          ANTHROPIC_API_KEY on the server to enable the live model.
        </Callout>
      ) : (
        <Callout tone="info" title="Live AI analyst">
          Answers are generated by {data.model ?? "the configured model"} from your saved property details, assumptions and calculated results only. It has no access to listings,
          public records or market data. Every claim is labelled calculated, user-supplied, assumption or unverified hypothesis.
        </Callout>
      )}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Investment review"
            actions={
              <Button size="sm" onClick={() => review.mutate()} loading={review.isPending}>
                <Sparkles /> {latestReview ? "Refresh review" : "Generate review"}
              </Button>
            }
          />
          <CardBody>
            {latestReview ? (
              <ReviewView review={latestReview.content as AiReview} msg={latestReview} />
            ) : (
              <EmptyState icon={<Bot />} title="No review yet" description="Generate a review, or run the analysis workflow from the Overview tab." />
            )}
          </CardBody>
        </Card>
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader title="Ask the analyst" description="Questions about this deal's numbers, financing, risks or missing evidence." />
          <CardBody className="flex flex-1 flex-col gap-3">
            <ol className="max-h-[480px] flex-1 space-y-3 overflow-y-auto" aria-live="polite" aria-label="Conversation">
              {chat.length === 0 && <li className="text-sm text-slate-500">Try: “Explain the cap rate”, “What evidence is missing?”, or “How do the financing scenarios compare?”</li>}
              {chat.map((m) =>
                m.kind === "question" ? (
                  <li key={m.id} className="flex gap-2">
                    <UserRound className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
                    <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-950">
                      <span className="sr-only">You: </span>
                      {(m.content as { question: string }).question}
                    </p>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-2">
                    <Bot className="mt-1 size-4 shrink-0 text-accent-600" aria-hidden />
                    <div className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <span className="sr-only">Analyst: </span>
                      <p className="whitespace-pre-line text-slate-800">{(m.content as AiAnswer).answer}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <BasisBadge basis={(m.content as AiAnswer).basis} />
                        {m.mode === "demo" && <Badge tone="amber">Demo</Badge>}
                      </div>
                      {(m.content as AiAnswer).followUps?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(m.content as AiAnswer).followUps.map((f) => (
                            <button key={f} type="button" className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-navy-300" onClick={() => ask.mutate(f)} disabled={ask.isPending}>
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ol>
            <form onSubmit={submit} className="space-y-2">
              <label htmlFor="ai-question" className="sr-only">
                Your question
              </label>
              <Textarea
                id="ai-question"
                rows={2}
                maxLength={1000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this deal…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={ask.isPending} disabled={question.trim().length < 3}>
                  <Send /> Ask
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
