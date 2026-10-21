import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import {
  SAMPLE_PROPERTIES,
  type PropertyFacts,
  type PropertyInput,
  type PropertySearch,
  type PropertyUpdate,
  type SourceStatus,
} from "@workspace/dealpilot-core";
import { dpProperty, dpPropertySourceRecord, type DpDb, type DpProperty } from "@workspace/dealpilot-db";
import { HttpError, notFound } from "../lib/http";
import { logActivity } from "./activity";
import { getPreferences } from "./preferences";

export type SourceRecordDto = {
  id: string;
  sourceStatus: string;
  sourceName: string | null;
  sourceUrl: string | null;
  retrievedAt: Date;
  notes: string | null;
};

export type PropertyDto = DpProperty & { sources: SourceRecordDto[]; latestSource: SourceRecordDto | null };

async function attachSources(db: DpDb, rows: DpProperty[]): Promise<PropertyDto[]> {
  if (rows.length === 0) return [];
  const sources = await db
    .select()
    .from(dpPropertySourceRecord)
    .where(inArray(dpPropertySourceRecord.propertyId, rows.map((r) => r.id)))
    .orderBy(desc(dpPropertySourceRecord.retrievedAt));
  return rows.map((r) => {
    const own = sources
      .filter((s) => s.propertyId === r.id)
      .map(({ id, sourceStatus, sourceName, sourceUrl, retrievedAt, notes }) => ({ id, sourceStatus, sourceName, sourceUrl, retrievedAt, notes }));
    return { ...r, sources: own, latestSource: own[0] ?? null };
  });
}

/** Rows this user may read: their own, plus the shared sample catalog if enabled. */
function visibleTo(userId: string, showSamples: boolean): SQL {
  const own = eq(dpProperty.ownerId, userId);
  return showSamples ? (or(own, and(isNull(dpProperty.ownerId), eq(dpProperty.isSample, true))) as SQL) : own;
}

export async function searchProperties(db: DpDb, userId: string, s: PropertySearch) {
  const prefs = await getPreferences(db, userId);
  const conditions: SQL[] = [visibleTo(userId, prefs.showSampleData)];
  if (!s.includeArchived) conditions.push(isNull(dpProperty.archivedAt));
  if (s.category) conditions.push(eq(dpProperty.category, s.category));
  if (s.propertyType) conditions.push(eq(dpProperty.propertyType, s.propertyType));
  if (s.sourceStatus) conditions.push(eq(dpProperty.sourceStatus, s.sourceStatus));
  if (s.minPrice !== undefined) conditions.push(gte(dpProperty.listPrice, s.minPrice));
  if (s.maxPrice !== undefined) conditions.push(lte(dpProperty.listPrice, s.maxPrice));
  if (s.minBeds !== undefined) conditions.push(gte(dpProperty.beds, s.minBeds));
  if (s.state) conditions.push(ilike(dpProperty.state, s.state));
  if (s.q) {
    const like = `%${s.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(dpProperty.title, like), ilike(dpProperty.addressLine, like), ilike(dpProperty.city, like), ilike(dpProperty.postalCode, like)) as SQL);
  }
  const where = and(...conditions);
  const orderBy = {
    newest: [desc(dpProperty.createdAt), asc(dpProperty.title)],
    price_asc: [sql`${dpProperty.listPrice} asc nulls last`, asc(dpProperty.title)],
    price_desc: [sql`${dpProperty.listPrice} desc nulls last`, asc(dpProperty.title)],
    rent_yield_desc: [sql`(${dpProperty.estimatedRentMonthly} / nullif(${dpProperty.listPrice}, 0)) desc nulls last`, asc(dpProperty.title)],
    title_asc: [asc(dpProperty.title)],
  }[s.sort];

  const [{ total }] = await db.select({ total: count() }).from(dpProperty).where(where);
  const rows = await db
    .select()
    .from(dpProperty)
    .where(where)
    .orderBy(...orderBy)
    .limit(s.pageSize)
    .offset((s.page - 1) * s.pageSize);
  return {
    items: await attachSources(db, rows),
    page: s.page,
    pageSize: s.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / s.pageSize)),
    showingSamples: prefs.showSampleData,
  };
}

export async function getVisibleProperty(db: DpDb, userId: string, id: string): Promise<PropertyDto> {
  const [row] = await db
    .select()
    .from(dpProperty)
    .where(and(eq(dpProperty.id, id), or(eq(dpProperty.ownerId, userId), and(isNull(dpProperty.ownerId), eq(dpProperty.isSample, true)))));
  if (!row) throw notFound("Property");
  return (await attachSources(db, [row]))[0];
}

export async function getOwnedProperty(db: DpDb, userId: string, id: string): Promise<DpProperty> {
  const [row] = await db.select().from(dpProperty).where(and(eq(dpProperty.id, id), eq(dpProperty.ownerId, userId)));
  if (!row) {
    const [catalog] = await db.select({ id: dpProperty.id }).from(dpProperty).where(and(eq(dpProperty.id, id), isNull(dpProperty.ownerId)));
    if (catalog) throw new HttpError(403, "Sample catalog properties are read-only. Save it as a deal to get your own editable copy.");
    throw notFound("Property");
  }
  return row;
}

function columnsFrom<T extends PropertyUpdate>(input: T): Omit<T, "sourceUrl" | "sourceName"> {
  const { sourceUrl: _u, sourceName: _n, ...rest } = input;
  return rest;
}

export async function createProperty(db: DpDb, userId: string, input: PropertyInput, sourceStatus: SourceStatus = "manual_entry"): Promise<PropertyDto> {
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(dpProperty)
      .values({ ...columnsFrom(input), ownerId: userId, isSample: false, sourceStatus })
      .returning();
    await tx.insert(dpPropertySourceRecord).values({
      propertyId: created.id,
      sourceStatus,
      sourceName: input.sourceName || (sourceStatus === "user_imported" ? "CSV import" : "Manual entry"),
      sourceUrl: input.sourceUrl || null,
    });
    return created;
  });
  await logActivity(db, { ownerId: userId, propertyId: row.id, type: "property.created", message: `Added property "${row.title}" (${sourceStatus.replace("_", " ")}).` });
  return getVisibleProperty(db, userId, row.id);
}

export async function updateProperty(db: DpDb, userId: string, id: string, input: PropertyUpdate): Promise<PropertyDto> {
  const existing = await getOwnedProperty(db, userId, id);
  const columns = columnsFrom(input);
  if (Object.keys(columns).length > 0) {
    await db.update(dpProperty).set(columns).where(eq(dpProperty.id, existing.id));
  }
  if (input.sourceName !== undefined || input.sourceUrl !== undefined) {
    await db.insert(dpPropertySourceRecord).values({
      propertyId: existing.id,
      sourceStatus: existing.sourceStatus,
      sourceName: input.sourceName || "Manual edit",
      sourceUrl: input.sourceUrl || null,
      notes: "Source details updated by user",
    });
  }
  await logActivity(db, { ownerId: userId, propertyId: id, type: "property.updated", message: `Updated property "${existing.title}".` });
  return getVisibleProperty(db, userId, id);
}

export async function setPropertyArchived(db: DpDb, userId: string, id: string, archived: boolean): Promise<PropertyDto> {
  const existing = await getOwnedProperty(db, userId, id);
  await db
    .update(dpProperty)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(dpProperty.id, existing.id));
  await logActivity(db, {
    ownerId: userId,
    propertyId: id,
    type: archived ? "property.archived" : "property.restored",
    message: `${archived ? "Archived" : "Restored"} property "${existing.title}".`,
  });
  return getVisibleProperty(db, userId, id);
}

export async function importProperties(db: DpDb, userId: string, rows: { row: number; data: PropertyInput }[]) {
  const created: string[] = [];
  await db.transaction(async (tx) => {
    for (const { data } of rows) {
      const [p] = await tx
        .insert(dpProperty)
        .values({ ...columnsFrom(data), ownerId: userId, isSample: false, sourceStatus: "user_imported" })
        .returning({ id: dpProperty.id });
      await tx.insert(dpPropertySourceRecord).values({
        propertyId: p.id,
        sourceStatus: "user_imported",
        sourceName: data.sourceName || "CSV import",
        sourceUrl: data.sourceUrl || null,
        notes: "Imported from a user-supplied CSV file",
      });
      created.push(p.id);
    }
  });
  if (created.length > 0) {
    await logActivity(db, { ownerId: userId, type: "property.imported", message: `Imported ${created.length} propert${created.length === 1 ? "y" : "ies"} from CSV.` });
  }
  return created;
}

/** Copies a catalog sample into the user's ownership so it can be edited and analysed. */
export async function cloneSampleForUser(db: DpDb, userId: string, sample: PropertyDto): Promise<DpProperty> {
  return db.transaction(async (tx) => {
    const { id: _id, ownerId: _o, createdAt: _c, updatedAt: _u, sources: _s, latestSource: _l, archivedAt: _a, ...fields } = sample;
    const [copy] = await tx
      .insert(dpProperty)
      .values({ ...fields, ownerId: userId, isSample: true, sourceStatus: "demo" })
      .returning();
    await tx.insert(dpPropertySourceRecord).values({
      propertyId: copy.id,
      sourceStatus: "demo",
      sourceName: "Sample dataset (fictional)",
      sourceUrl: null,
      notes: `Copied from sample ${sample.sampleKey ?? sample.id}. SAMPLE DATA — NOT REAL LISTINGS.`,
    });
    return copy;
  });
}

/** Idempotently upserts the fictional sample catalog. */
export async function seedSampleCatalog(db: DpDb): Promise<number> {
  let inserted = 0;
  for (const sample of SAMPLE_PROPERTIES) {
    const [existing] = await db
      .select({ id: dpProperty.id })
      .from(dpProperty)
      .where(and(isNull(dpProperty.ownerId), eq(dpProperty.sampleKey, sample.sampleKey)));
    const { sampleKey, sourceName: _sn, sourceUrl: _su, ...fields } = sample;
    if (existing) {
      await db.update(dpProperty).set({ ...fields, isSample: true, sourceStatus: "demo" }).where(eq(dpProperty.id, existing.id));
      continue;
    }
    const [row] = await db
      .insert(dpProperty)
      .values({ ...fields, sampleKey, ownerId: null, isSample: true, sourceStatus: "demo" })
      .returning({ id: dpProperty.id });
    await db.insert(dpPropertySourceRecord).values({
      propertyId: row.id,
      sourceStatus: "demo",
      sourceName: "Sample dataset (fictional)",
      notes: "SAMPLE DATA — NOT REAL LISTINGS.",
    });
    inserted++;
  }
  return inserted;
}

export function toFacts(p: PropertyDto): PropertyFacts {
  return {
    title: p.title,
    addressLine: p.addressLine,
    city: p.city,
    state: p.state,
    category: p.category as PropertyFacts["category"],
    propertyType: p.propertyType as PropertyFacts["propertyType"],
    sourceStatus: p.sourceStatus as PropertyFacts["sourceStatus"],
    isSample: p.isSample,
    listPrice: p.listPrice,
    units: p.units,
    beds: p.beds,
    baths: p.baths,
    squareFeet: p.squareFeet,
    yearBuilt: p.yearBuilt,
    description: p.description,
    sourceName: p.latestSource?.sourceName ?? null,
    sourceRetrievedAt: p.latestSource ? new Date(p.latestSource.retrievedAt).toISOString() : null,
  };
}
