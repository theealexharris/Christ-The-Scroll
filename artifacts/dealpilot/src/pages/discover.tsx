import { DEAL_CATEGORIES, PROPERTY_SORTS, PROPERTY_TYPES, SOURCE_STATUSES, type PropertyInput } from "@workspace/dealpilot-core";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, ChevronLeft, ChevronRight, FilePlus2, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { CsvImport } from "@/components/csv-import";
import { PageHeader } from "@/components/layout/app-shell";
import { PropertyCard } from "@/components/property-card";
import { PropertyForm } from "@/components/property-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Callout, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useAnalyzeProperty } from "@/hooks/use-analyze";
import { api, errorMessage, queryString } from "@/lib/api";
import type { Property, PropertyPage, SavedSearch } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<(typeof PROPERTY_SORTS)[number], string> = {
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rent_yield_desc: "Rent-to-price (high first)",
  title_asc: "Name A–Z",
};

const FILTER_KEYS = ["q", "category", "propertyType", "sourceStatus", "minPrice", "maxPrice", "minBeds", "state", "sort", "page", "includeArchived"] as const;
type Filters = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

function readFilters(search: string): Filters {
  const sp = new URLSearchParams(search);
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v) f[k] = v;
  }
  return f;
}

export default function DiscoverPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const filters = useMemo(() => readFilters(search), [search]);
  const newParam = new URLSearchParams(search).get("new");
  const [q, setQ] = useState(filters.q ?? "");
  const [dialog, setDialog] = useState<"manual" | "csv" | "save" | null>(newParam === "manual" || newParam === "csv" ? newParam : null);
  const [saveName, setSaveName] = useState("");
  const qc = useQueryClient();
  const analyze = useAnalyzeProperty();

  const setFilters = (patch: Filters, resetPage = true) => {
    const next: Filters = { ...filters, ...patch, ...(resetPage ? { page: undefined } : {}) };
    navigate(`/discover${queryString(next)}`, { replace: true });
  };

  // Debounce the text search into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q) setFilters({ q: q || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["properties", filters],
    queryFn: () => api.get<PropertyPage>(`/api/properties${queryString({ ...filters, pageSize: 12 })}`),
    placeholderData: keepPreviousData,
  });
  const saved = useQuery({ queryKey: ["saved-searches"], queryFn: () => api.get<{ items: SavedSearch[] }>("/api/saved-searches") });

  const createProperty = useMutation({
    mutationFn: (input: PropertyInput) => api.post<Property>("/api/properties", input),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      setDialog(null);
      toast.success("Property added");
      navigate(`/properties/${p.id}`);
    },
  });
  const saveSearch = useMutation({
    mutationFn: () => {
      const { page: _p, ...rest } = filters;
      const typed: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v === undefined) continue;
        typed[k] = ["minPrice", "maxPrice", "minBeds"].includes(k) ? Number(v) : k === "includeArchived" ? v === "true" : v;
      }
      return api.post<SavedSearch>("/api/saved-searches", { name: saveName, filters: typed });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      setDialog(null);
      setSaveName("");
      toast.success("Search saved");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const deleteSearch = useMutation({
    mutationFn: (id: string) => api.delete(`/api/saved-searches/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !["page", "sort"].includes(k)).length;
  const page = Number(filters.page ?? 1);

  return (
    <>
      <PageHeader
        title="Discover deals"
        description="Browse properties by opportunity type. Each record shows where it came from; no live listing or public-records feed is connected in this build."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog("csv")}>
              <Upload /> Import CSV
            </Button>
            <Button onClick={() => setDialog("manual")}>
              <FilePlus2 /> Add manually
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Opportunity category">
        {[{ id: "", label: "All" }, ...DEAL_CATEGORIES].map((c) => {
          const active = (filters.category ?? "") === c.id;
          return (
            <button
              key={c.id || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters({ category: c.id || undefined })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-navy-300",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <Callout tone="info" className="mb-4">
        <strong>Data sources for {filters.category ? DEAL_CATEGORIES.find((c) => c.id === filters.category)?.label.toLowerCase() : "all categories"}:</strong> Live provider — not
        configured · User-imported — available · Manual entry — available · Demo — fictional samples. Category labels describe the opportunity type you assign; they do not mean
        the data came from an official court, sheriff, bank or tax authority.
      </Callout>

      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <Field label="Search" htmlFor="f-q">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input id="f-q" className="pl-9" placeholder="Address, city, ZIP or name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Field>
        </div>
        <Field label="Property type" htmlFor="f-type">
          <Select id="f-type" value={filters.propertyType ?? ""} onChange={(e) => setFilters({ propertyType: e.target.value || undefined })}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="f-source">
          <Select id="f-source" value={filters.sourceStatus ?? ""} onChange={(e) => setFilters({ sourceStatus: e.target.value || undefined })}>
            <option value="">Any source</option>
            {SOURCE_STATUSES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min price" htmlFor="f-min">
            <Input id="f-min" inputMode="numeric" type="number" min={0} value={filters.minPrice ?? ""} onChange={(e) => setFilters({ minPrice: e.target.value || undefined })} />
          </Field>
          <Field label="Max price" htmlFor="f-max">
            <Input id="f-max" inputMode="numeric" type="number" min={0} value={filters.maxPrice ?? ""} onChange={(e) => setFilters({ maxPrice: e.target.value || undefined })} />
          </Field>
        </div>
        <Field label="Sort by" htmlFor="f-sort">
          <Select id="f-sort" value={filters.sort ?? "newest"} onChange={(e) => setFilters({ sort: e.target.value })}>
            {PROPERTY_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-navy-900" checked={filters.includeArchived === "true"} onChange={(e) => setFilters({ includeArchived: e.target.checked ? "true" : undefined })} />
            Include archived
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  navigate("/discover", { replace: true });
                }}
              >
                <X /> Clear filters
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setDialog("save")} disabled={activeFilterCount === 0} title={activeFilterCount === 0 ? "Apply at least one filter to save a search" : undefined}>
              <BookmarkPlus /> Save search
            </Button>
          </div>
        </div>
      </div>

      {saved.data && saved.data.items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Saved searches:</span>
          {saved.data.items.map((s) => (
            <span key={s.id} className="inline-flex items-center rounded-full border border-slate-300 bg-white">
              <button
                type="button"
                className="px-3 py-1 hover:text-navy-800"
                onClick={() => {
                  const f = Object.fromEntries(Object.entries(s.filters).map(([k, v]) => [k, String(v)]));
                  setQ((f.q as string) ?? "");
                  navigate(`/discover${queryString(f)}`, { replace: true });
                }}
              >
                {s.name}
              </button>
              <button type="button" className="rounded-r-full px-2 py-1 text-slate-400 hover:text-red-700" aria-label={`Delete saved search ${s.name}`} onClick={() => deleteSearch.mutate(s.id)}>
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading properties">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}
      {data && (
        <>
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">
            {data.total} propert{data.total === 1 ? "y" : "ies"}
            {isFetching && " · updating…"}
            {!data.showingSamples && " · sample data hidden (change in Settings)"}
          </p>
          {data.items.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No properties match"
              description={activeFilterCount ? "Try removing a filter, or add a property you're evaluating." : "Add a property manually or import a CSV to get started."}
              action={
                <Button onClick={() => setDialog("manual")}>
                  <FilePlus2 /> Add a property
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((p) => (
                <PropertyCard key={p.id} property={p} onAnalyze={(prop) => analyze.mutate(prop)} analyzing={analyze.isPending && analyze.variables?.id === p.id} />
              ))}
            </div>
          )}
          {data.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setFilters({ page: String(page - 1) }, false)}>
                <ChevronLeft /> Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {data.page} of {data.totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= data.totalPages} onClick={() => setFilters({ page: String(page + 1) }, false)}>
                Next <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}

      <Dialog open={dialog === "manual"} onOpenChange={(o) => setDialog(o ? "manual" : null)}>
        <DialogContent title="Add a property manually" description="Saved as “Manual entry” in your private workspace.">
          <PropertyForm submitLabel="Add property" onSubmit={(input) => createProperty.mutateAsync(input)} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "csv"} onOpenChange={(o) => setDialog(o ? "csv" : null)}>
        <DialogContent title="Import properties from CSV">
          <CsvImport
            onImported={(n) => {
              qc.invalidateQueries({ queryKey: ["properties"] });
              setDialog(null);
              toast.success(`Imported ${n} propert${n === 1 ? "y" : "ies"}`);
              setFilters({ sourceStatus: "user_imported" });
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "save"} onOpenChange={(o) => setDialog(o ? "save" : null)}>
        <DialogContent title="Save this search" className="max-w-md">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveSearch.mutate();
            }}
          >
            <Field label="Name" htmlFor="ss-name" required>
              <Input id="ss-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={100} autoFocus />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={!saveName.trim()} loading={saveSearch.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
