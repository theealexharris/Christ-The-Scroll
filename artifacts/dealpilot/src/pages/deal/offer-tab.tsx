import { BRAND, buildOfferSections, OfferTermsSchema, type OfferTerms } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SampleLabel } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, NumberInput, Textarea } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, CardHeader, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { GeneratedDocument, OfferDraft, OfferDraftList } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function OfferTab({ dealId, isSample }: { dealId: string; isSample: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["offer-drafts", dealId], queryFn: () => api.get<OfferDraftList>(`/api/deals/${dealId}/offer-drafts`) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [terms, setTerms] = useState<OfferTerms | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");

  const selected: OfferDraft | undefined = data?.items.find((d) => d.id === selectedId) ?? data?.items[0];
  useEffect(() => {
    if (!data) return;
    const base = selected?.terms ?? data.suggestedTerms;
    if (base) setTerms(base);
    setChecklist(selected?.checklist ?? {});
    setNote("");
  }, [data, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo(() => (terms ? OfferTermsSchema.safeParse(terms) : null), [terms]);
  const errors: Record<string, string> = {};
  if (parsed && !parsed.success) for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  const dirty = JSON.stringify(terms) !== JSON.stringify(selected?.terms) || JSON.stringify(checklist) !== JSON.stringify(selected?.checklist ?? {});

  const save = useMutation({
    mutationFn: () => api.post<OfferDraft>(`/api/deals/${dealId}/offer-drafts`, { terms: parsed && parsed.success ? parsed.data : terms, checklist, note: note || undefined }),
    onSuccess: (d) => {
      setSelectedId(d.id);
      qc.invalidateQueries({ queryKey: ["offer-drafts", dealId] });
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Saved draft version ${d.version}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const exportDoc = useMutation({
    mutationFn: ({ draftId, format }: { draftId: string; format: "pdf" | "docx" }) => api.post<GeneratedDocument>(`/api/offer-drafts/${draftId}/documents`, { format }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents", dealId] });
      window.location.assign(`/api/documents/${doc.id}/download`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock rows={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!terms) return <LoadingBlock rows={2} />;
  const set = <K extends keyof OfferTerms>(k: K, v: OfferTerms[K]) => setTerms((t) => (t ? { ...t, [k]: v } : t));
  const text = (k: keyof OfferTerms, label: string, type = "text") => (
    <Field label={label} htmlFor={`of-${k}`} error={errors[k]}>
      <Input
        id={`of-${k}`}
        type={type}
        value={(terms[k] as string | null) ?? ""}
        onChange={(e) => set(k, (type === "date" ? e.target.value || null : e.target.value) as never)}
        invalid={!!errors[k]}
        aria-describedby={describedBy(`of-${k}`, errors[k])}
      />
    </Field>
  );
  const money = (k: keyof OfferTerms, label: string) => (
    <Field label={label} htmlFor={`of-${k}`} error={errors[k]}>
      <NumberInput id={`of-${k}`} value={terms[k] as number} onValueChange={(v) => set(k, (v ?? 0) as never)} prefix="$" invalid={!!errors[k]} />
    </Field>
  );
  const allChecked = data.checklist.every((c) => checklist[c.key]);
  const sections = buildOfferSections(terms, selected ? selected.version : 1);

  return (
    <div className="space-y-6">
      <Callout tone="warning" title={BRAND.draftLabel}>
        Offer summaries are drafts for your own review and for a licensed agent or attorney. {BRAND.name} never sends offers, contacts sellers or creates binding signatures.
        Final offers must use the forms required in your jurisdiction.
      </Callout>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Draft terms"
            description={selected ? `Editing from version ${selected.version}. Saving creates a new version.` : "Suggested from your underwriting. Saving creates version 1."}
            actions={
              <Button size="sm" onClick={() => save.mutate()} disabled={!parsed?.success || (!dirty && !!selected)} loading={save.isPending}>
                <Save /> Save new version
              </Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {text("buyerName", "Buyer name")}
              {text("sellerName", "Seller name")}
              <div className="sm:col-span-2">{text("propertyAddress", "Property address")}</div>
              {money("proposedPrice", "Proposed price")}
              {money("earnestMoney", "Earnest money")}
              <Field label="Due-diligence period" htmlFor="of-dd" error={errors.dueDiligenceDays}>
                <NumberInput id="of-dd" value={terms.dueDiligenceDays} onValueChange={(v) => set("dueDiligenceDays", Math.round(v ?? 0))} suffix="days" step="1" />
              </Field>
              {money("sellerConcessions", "Requested seller concessions")}
              {text("closingDate", "Target closing date", "date")}
              {text("offerExpiration", "Offer expiration", "date")}
            </div>
            <div className="space-y-2">
              <Checkbox id="of-inspection" label="Inspection contingency" checked={terms.inspectionContingency} onChange={(v) => set("inspectionContingency", v)} />
              <Checkbox id="of-financing" label="Financing contingency" checked={terms.financingContingency} onChange={(v) => set("financingContingency", v)} />
              {terms.financingContingency && <div className="pl-7">{text("financingType", "Financing type")}</div>}
              <Checkbox id="of-appraisal" label="Appraisal contingency" checked={terms.appraisalContingency} onChange={(v) => set("appraisalContingency", v)} />
            </div>
            <Field label="Additional terms" htmlFor="of-additional" error={errors.additionalTerms}>
              <Textarea id="of-additional" value={terms.additionalTerms} onChange={(e) => set("additionalTerms", e.target.value)} maxLength={5000} />
            </Field>
            <Field label="Version note (optional)" htmlFor="of-note">
              <Input id="of-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What changed in this version?" />
            </Field>
            <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-navy-950">Review checklist</legend>
              {data.checklist.map((c) => (
                <Checkbox key={c.key} id={`chk-${c.key}`} label={c.label} checked={!!checklist[c.key]} onChange={(v) => setChecklist((x) => ({ ...x, [c.key]: v }))} />
              ))}
              {!allChecked && <p className="text-xs text-amber-800">Complete the checklist before sharing this draft with anyone.</p>}
            </fieldset>
          </CardBody>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Preview"
              actions={
                selected && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => exportDoc.mutate({ draftId: selected.id, format: "pdf" })} loading={exportDoc.isPending && exportDoc.variables?.format === "pdf"} title={dirty ? "Exports the saved version, not unsaved edits" : undefined}>
                      <Download /> PDF
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => exportDoc.mutate({ draftId: selected.id, format: "docx" })} loading={exportDoc.isPending && exportDoc.variables?.format === "docx"} title={dirty ? "Exports the saved version, not unsaved edits" : undefined}>
                      <FileText /> Word
                    </Button>
                  </>
                )
              }
            />
            <CardBody className="space-y-3 text-sm">
              <p className="rounded bg-red-50 px-2 py-1 text-center text-xs font-bold tracking-wide text-red-800">{BRAND.draftLabel}</p>
              {isSample && <SampleLabel />}
              {!selected && <p className="text-xs text-slate-500">Save a version to enable PDF and Word export.</p>}
              {dirty && selected && <p className="text-xs text-amber-800">Unsaved changes — exports use the last saved version.</p>}
              {sections.slice(1).map((s) => (
                <section key={s.heading}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.heading}</h4>
                  {s.lines.map((l, i) => (
                    <p key={i} className="text-slate-800">
                      {l}
                    </p>
                  ))}
                </section>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Version history" />
            <CardBody>
              {data.items.length === 0 ? (
                <p className="text-sm text-slate-500">No versions saved yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.items.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        aria-current={selected?.id === d.id ? "true" : undefined}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-navy-300 aria-[current=true]:border-navy-900 aria-[current=true]:bg-navy-50"
                      >
                        <span>
                          <span className="font-medium">Version {d.version}</span>
                          {d.note && <span className="block text-xs text-slate-500">{d.note}</span>}
                        </span>
                        <span className="text-right text-xs text-slate-500">
                          {formatDateTime(d.createdAt)}
                          <Badge tone="red" className="mt-1 block">
                            Draft
                          </Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
