import { and, asc, eq, ilike, or } from "drizzle-orm";
import {
  db,
  booksTable,
  versesTable,
  peopleTable,
  placesTable,
  eventsTable,
  journeysTable,
  journeyStopsTable,
  readingProgressTable,
} from "@workspace/db";
import type {
  Book,
  Chapter,
  Event,
  EventSummary,
  Journey,
  JourneySummary,
  Person,
  PersonSummary,
  Place,
  PlaceSummary,
  ReadingProgress,
  TimelineEvent,
  Verse,
} from "@workspace/api-zod";

type BookRow = typeof booksTable.$inferSelect;
type VerseRow = typeof versesTable.$inferSelect;
type PersonRow = typeof peopleTable.$inferSelect;
type PlaceRow = typeof placesTable.$inferSelect;
type EventRow = typeof eventsTable.$inferSelect;

function toBook(row: BookRow): Book {
  return { id: row.slug, slug: row.slug, name: row.name, testament: row.testament, category: row.category, chapterCount: row.chapterCount };
}

function toVerse(row: VerseRow, bookName: string): Verse {
  return {
    id: row.id,
    bookSlug: row.bookSlug,
    bookName,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    reference: row.reference,
    translation: row.translation,
  };
}

function toPersonSummary(row: PersonRow): PersonSummary {
  return { slug: row.slug, name: row.name, role: row.role, description: row.description };
}

function toPlaceSummary(row: PlaceRow): PlaceSummary {
  return { slug: row.slug, name: row.name, region: row.region, confidence: row.confidence };
}

function toEventSummary(row: EventRow): EventSummary {
  return { slug: row.slug, name: row.name, summary: row.summary, period: row.period };
}

export async function getBooks(): Promise<Book[]> {
  const rows = await db.select().from(booksTable).orderBy(asc(booksTable.sortOrder));
  return rows.map(toBook);
}

export async function getChapter(bookSlug: string, chapter: number): Promise<Chapter | null> {
  const [book] = await db.select().from(booksTable).where(eq(booksTable.slug, bookSlug)).limit(1);
  if (!book) return null;

  let verseRows = await db
    .select()
    .from(versesTable)
    .where(and(eq(versesTable.bookSlug, bookSlug), eq(versesTable.chapter, chapter)))
    .orderBy(asc(versesTable.verse));

  // Fall back to a sample passage for an out-of-range chapter number rather than a bare 404.
  if (verseRows.length === 0) {
    verseRows = await db
      .select()
      .from(versesTable)
      .where(and(eq(versesTable.bookSlug, "mark"), eq(versesTable.chapter, 1)))
      .orderBy(asc(versesTable.verse));
  }

  return {
    book: toBook(book),
    chapter,
    verses: verseRows.map((row) => toVerse(row, book.name)),
  };
}

export async function getVerseById(id: string): Promise<Verse | null> {
  const [row] = await db.select().from(versesTable).where(eq(versesTable.id, id)).limit(1);
  if (!row) return getFallbackVerse();
  const [book] = await db.select().from(booksTable).where(eq(booksTable.slug, row.bookSlug)).limit(1);
  return toVerse(row, book?.name ?? row.bookSlug);
}

async function getFallbackVerse(): Promise<Verse | null> {
  const [row] = await db
    .select()
    .from(versesTable)
    .where(and(eq(versesTable.bookSlug, "mark"), eq(versesTable.chapter, 1), eq(versesTable.verse, 16)))
    .limit(1);
  if (!row) return null;
  const [book] = await db.select().from(booksTable).where(eq(booksTable.slug, "mark")).limit(1);
  return toVerse(row, book?.name ?? "Mark");
}

export async function getPeople(): Promise<PersonSummary[]> {
  const rows = await db.select().from(peopleTable).orderBy(asc(peopleTable.name));
  return rows.map(toPersonSummary);
}

export async function getPerson(slug: string): Promise<Person | null> {
  const [row] = await db.select().from(peopleTable).where(eq(peopleTable.slug, slug)).limit(1);
  if (!row) return null;
  const [places, events] = await Promise.all([getRelatedPlaces(), getRelatedEvents()]);
  return {
    ...toPersonSummary(row),
    scriptureReferences: row.scriptureReferences,
    places,
    events,
    timeline: (await getTimeline()).slice(6, 10),
  };
}

export async function getPlaces(): Promise<PlaceSummary[]> {
  const rows = await db.select().from(placesTable).orderBy(asc(placesTable.name));
  return rows.map(toPlaceSummary);
}

export async function getPlace(slug: string): Promise<Place | null> {
  const [row] = await db.select().from(placesTable).where(eq(placesTable.slug, slug)).limit(1);
  if (!row) return null;
  const people = await getRelatedPeople();
  const events = await getRelatedEvents();
  return {
    ...toPlaceSummary(row),
    ancientName: row.ancientName ?? row.name,
    latitude: row.latitude ?? 31.9,
    longitude: row.longitude ?? 35.2,
    historicalNotes: row.historicalNotes ?? "",
    scriptureReferences: row.scriptureReferences,
    people,
    events,
  };
}

export async function getEvents(): Promise<EventSummary[]> {
  const rows = await db.select().from(eventsTable).orderBy(asc(eventsTable.sortOrder));
  return rows.map(toEventSummary);
}

export async function getEvent(slug: string): Promise<Event | null> {
  const [row] = await db.select().from(eventsTable).where(eq(eventsTable.slug, slug)).limit(1);
  if (!row) return null;
  const people = await getRelatedPeople();
  const places = await getRelatedPlaces();
  return {
    ...toEventSummary(row),
    scriptureReferences: row.scriptureReferences,
    people,
    places,
    before: row.before ?? "The story prepares for this moment",
    after: row.after ?? "The story continues into a new chapter",
  };
}

export async function getTimeline(): Promise<TimelineEvent[]> {
  const rows = await db.select().from(eventsTable).orderBy(asc(eventsTable.sortOrder));
  return rows.map((row) => ({
    slug: row.slug,
    title: row.name,
    period: row.period,
    dateLabel: row.dateLabel,
    description: row.summary,
    scriptureReferences: row.scriptureReferences,
  }));
}

export async function getJourneySummaries(): Promise<JourneySummary[]> {
  const rows = await db.select().from(journeysTable);
  const withCounts = await Promise.all(
    rows.map(async (row) => {
      const stops = await db.select().from(journeyStopsTable).where(eq(journeyStopsTable.journeySlug, row.slug));
      return { slug: row.slug, title: row.title, subtitle: row.subtitle, stopCount: stops.length, durationLabel: row.durationLabel };
    }),
  );
  return withCounts;
}

export async function getJourney(slug: string): Promise<Journey | null> {
  const [row] = await db.select().from(journeysTable).where(eq(journeysTable.slug, slug)).limit(1);
  if (!row) return null;
  const stops = await db
    .select()
    .from(journeyStopsTable)
    .where(eq(journeyStopsTable.journeySlug, slug))
    .orderBy(asc(journeyStopsTable.sortOrder));
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    durationLabel: row.durationLabel,
    stopCount: stops.length,
    stops: stops.map((stop) => ({
      title: stop.title,
      location: stop.location,
      description: stop.description,
      scriptureReferences: stop.scriptureReferences,
      placeSlug: stop.placeSlug,
    })),
  };
}

export async function searchVerses(query: string): Promise<Verse[]> {
  const rows = await db
    .select()
    .from(versesTable)
    .where(or(ilike(versesTable.reference, `%${query}%`), ilike(versesTable.text, `%${query}%`)))
    .limit(10);
  const bookNames = new Map((await db.select().from(booksTable)).map((book) => [book.slug, book.name]));
  return rows.map((row) => toVerse(row, bookNames.get(row.bookSlug) ?? row.bookSlug));
}

export async function searchPeople(query: string): Promise<PersonSummary[]> {
  const rows = await db
    .select()
    .from(peopleTable)
    .where(or(ilike(peopleTable.name, `%${query}%`), ilike(peopleTable.description, `%${query}%`)))
    .limit(10);
  return rows.map(toPersonSummary);
}

export async function searchPlaces(query: string): Promise<PlaceSummary[]> {
  const rows = await db.select().from(placesTable).where(ilike(placesTable.name, `%${query}%`)).limit(10);
  return rows.map(toPlaceSummary);
}

export async function searchEvents(query: string): Promise<EventSummary[]> {
  const rows = await db
    .select()
    .from(eventsTable)
    .where(or(ilike(eventsTable.name, `%${query}%`), ilike(eventsTable.summary, `%${query}%`)))
    .limit(10);
  return rows.map(toEventSummary);
}

export async function searchJourneys(query: string): Promise<JourneySummary[]> {
  const summaries = await getJourneySummaries();
  return summaries.filter((journey) => `${journey.title} ${journey.subtitle}`.toLowerCase().includes(query.toLowerCase()));
}

// Explore pages show a handful of related people/places/events alongside the
// item being viewed. The source data doesn't encode real cross-references, so
// (as in the original mock data) we surface a representative slice rather
// than inventing relationships that aren't backed by content.
async function getRelatedPeople(): Promise<PersonSummary[]> {
  const rows = await db.select().from(peopleTable).orderBy(asc(peopleTable.name)).limit(5);
  return rows.map(toPersonSummary);
}

async function getRelatedPlaces(): Promise<PlaceSummary[]> {
  const rows = await db.select().from(placesTable).orderBy(asc(placesTable.name)).limit(4);
  return rows.map(toPlaceSummary);
}

async function getRelatedEvents(): Promise<EventSummary[]> {
  const rows = await db.select().from(eventsTable).orderBy(asc(eventsTable.sortOrder)).limit(4).offset(6);
  return rows.map(toEventSummary);
}

const DEFAULT_PROGRESS: ReadingProgress = { bookSlug: "mark", chapter: 1, verse: 16, percent: 12, lastReference: "Mark 1:16" };

export async function getProgress(visitorId: string): Promise<ReadingProgress> {
  const [row] = await db.select().from(readingProgressTable).where(eq(readingProgressTable.visitorId, visitorId)).limit(1);
  if (!row) return DEFAULT_PROGRESS;
  return { bookSlug: row.bookSlug, chapter: row.chapter, verse: row.verse, percent: row.percent, lastReference: row.lastReference };
}

export async function saveProgress(visitorId: string, input: ReadingProgress): Promise<ReadingProgress> {
  await db
    .insert(readingProgressTable)
    .values({ visitorId, ...input })
    .onConflictDoUpdate({ target: readingProgressTable.visitorId, set: { ...input, updatedAt: new Date() } });
  return input;
}
