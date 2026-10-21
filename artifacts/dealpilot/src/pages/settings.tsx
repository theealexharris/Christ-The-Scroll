import { PreferencesSchema, type Preferences } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NumberInput } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, CardHeader, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";

export default function SettingsPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: session } = useSession();
  const user = session?.user as { email?: string; name?: string; isAnonymous?: boolean; createdAt?: string } | undefined;
  const prefsQuery = useQuery({ queryKey: ["preferences"], queryFn: () => api.get<Preferences>("/api/preferences") });
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const save = useMutation({
    mutationFn: (p: Preferences) => api.put<Preferences>("/api/preferences", p),
    onSuccess: (p) => {
      qc.setQueryData(["preferences"], p);
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Preferences saved");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const del = useMutation({
    mutationFn: () => api.delete("/api/account", { confirm: "DELETE" }),
    onSuccess: async () => {
      await authClient.signOut().catch(() => undefined);
      qc.clear();
      navigate("/login");
      toast.success("Your account and data were deleted");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const parsed = prefs ? PreferencesSchema.safeParse(prefs) : null;

  return (
    <>
      <PageHeader title="Settings" description="Account, analysis defaults and your data." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-2 text-sm">
            {user?.isAnonymous ? (
              <Callout tone="warning" title="Temporary demo workspace">
                This workspace isn't tied to an email address. If you sign out, you won't be able to get back into it. Create a regular account to keep your work.
              </Callout>
            ) : (
              <>
                <p>
                  <span className="text-slate-500">Email:</span> {user?.email}
                </p>
                <p>
                  <span className="text-slate-500">Name:</span> {user?.name}
                </p>
              </>
            )}
            <p className="text-xs text-slate-500">Passwords and sessions are handled by Better Auth on the server. Password reset by email is not configured in this build.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Analysis defaults" description="Used when you save a new deal. Existing deals are not changed." />
          <CardBody>
            {prefsQuery.isLoading && <LoadingBlock rows={2} />}
            {prefsQuery.error && <ErrorState error={prefsQuery.error} onRetry={() => prefsQuery.refetch()} />}
            {prefs && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (parsed?.success) save.mutate(parsed.data);
                }}
              >
                <Checkbox
                  id="pref-samples"
                  label="Show fictional sample properties in Discover"
                  checked={prefs.showSampleData}
                  onChange={(v) => setPrefs({ ...prefs, showSampleData: v })}
                  description="Sample properties are always labelled and never mixed into your own data."
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Vacancy" htmlFor="pref-vac">
                    <NumberInput id="pref-vac" value={prefs.defaultVacancyRatePct} onValueChange={(v) => setPrefs({ ...prefs, defaultVacancyRatePct: v ?? 0 })} suffix="%" />
                  </Field>
                  <Field label="Interest rate" htmlFor="pref-rate">
                    <NumberInput id="pref-rate" value={prefs.defaultInterestRatePct} onValueChange={(v) => setPrefs({ ...prefs, defaultInterestRatePct: v ?? 0 })} suffix="%" />
                  </Field>
                  <Field label="Down payment" htmlFor="pref-down">
                    <NumberInput id="pref-down" value={prefs.defaultDownPaymentPct} onValueChange={(v) => setPrefs({ ...prefs, defaultDownPaymentPct: v ?? 0 })} suffix="%" />
                  </Field>
                </div>
                {parsed && !parsed.success && <Callout tone="error">{parsed.error.issues[0]?.message}</Callout>}
                <div className="flex justify-end">
                  <Button type="submit" loading={save.isPending} disabled={!parsed?.success}>
                    Save defaults
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your data" />
          <CardBody className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">Export everything</p>
                <p className="text-xs text-slate-500">Download all properties, deals, analyses, tasks, offer drafts and activity as JSON.</p>
              </div>
              <Button variant="secondary" asChild>
                <a href="/api/account/export">
                  <Download /> Export JSON
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="font-medium text-red-800">Delete account</p>
                <p className="text-xs text-slate-500">Permanently deletes your account and all associated data. This cannot be undone.</p>
              </div>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete account
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Legal" />
          <CardBody className="space-y-2 text-sm">
            <p>
              <Link href="/legal/disclaimer" className="text-navy-700 underline">
                Real estate & AI disclaimer
              </Link>
            </p>
            <p>
              <Link href="/legal/privacy" className="text-navy-700 underline">
                Privacy notice
              </Link>{" "}
              <Badge tone="amber">Placeholder</Badge>
            </p>
            <p>
              <Link href="/legal/terms" className="text-navy-700 underline">
                Terms of use
              </Link>{" "}
              <Badge tone="amber">Placeholder</Badge>
            </p>
            <p className="text-xs text-slate-500">No payment details are collected. Billing is disabled.</p>
          </CardBody>
        </Card>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent title="Delete your account?" description="This permanently removes your account and every property, deal, analysis and document in it." className="max-w-md">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmText === "DELETE") del.mutate();
            }}
          >
            <Field label='Type "DELETE" to confirm' htmlFor="confirm-delete">
              <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={confirmText !== "DELETE"} loading={del.isPending}>
                Delete permanently
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
