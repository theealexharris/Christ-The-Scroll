import { DEAL_CATEGORIES, formatCurrency, labelFor, PROPERTY_TYPES } from "@workspace/dealpilot-core";
import { BedDouble, Building2, MapPin, Ruler } from "lucide-react";
import { Link } from "wouter";
import type { Property } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { SampleLabel, SourceBadge } from "./domain";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";

export function PropertyCard({ property: p, onAnalyze, analyzing }: { property: Property; onAnalyze: (p: Property) => void; analyzing?: boolean }) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md" aria-labelledby={`prop-${p.id}`}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="navy">{labelFor(DEAL_CATEGORIES, p.category)}</Badge>
          <SourceBadge status={p.sourceStatus} retrievedAt={p.latestSource?.retrievedAt} />
        </div>
        {p.archivedAt && <Badge>Archived</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        {p.isSample && <SampleLabel className="self-start" />}
        <div>
          <h3 id={`prop-${p.id}`} className="font-semibold text-navy-950">
            <Link href={`/properties/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {p.addressLine}, {p.city}, {p.state}
            </span>
          </p>
        </div>
        <p className="tabular text-2xl font-semibold text-navy-950">{p.listPrice !== null ? formatCurrency(p.listPrice) : <span className="text-base text-slate-500">Price not entered</span>}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden /> {labelFor(PROPERTY_TYPES, p.propertyType)}
          </li>
          {p.beds !== null && (
            <li className="flex items-center gap-1">
              <BedDouble className="size-3.5" aria-hidden /> {p.beds} bd · {p.baths ?? "—"} ba
            </li>
          )}
          {p.squareFeet !== null && (
            <li className="flex items-center gap-1">
              <Ruler className="size-3.5" aria-hidden /> {p.squareFeet.toLocaleString()} sqft
            </li>
          )}
        </ul>
        {p.estimatedRentMonthly !== null && (
          <p className="text-xs text-slate-600">
            Rent estimate (user/sample-supplied): <span className="tabular font-medium text-slate-800">{formatCurrency(p.estimatedRentMonthly)}/mo</span>
          </p>
        )}
        <p className="mt-auto text-[11px] text-slate-500">Source captured {formatDateTime(p.latestSource?.retrievedAt)}</p>
      </div>
      <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <Button asChild variant="secondary" size="sm" className="flex-1">
          <Link href={`/properties/${p.id}`}>Details</Link>
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onAnalyze(p)} loading={analyzing} disabled={!!p.archivedAt} title={p.archivedAt ? "Restore this property to analyze it" : undefined}>
          Analyze
        </Button>
      </div>
    </article>
  );
}
