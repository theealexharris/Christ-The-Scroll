import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import {
  AskPassageBody,
  ExplainPassageBody,
  GetChapterParams,
  GetJourneyParams,
  GetProgressResponse,
  GetPersonParams,
  GetPlaceParams,
  GetReadingPlanResponse,
  GetStatsResponse,
  GetVerseExplorationParams,
  GetVerseParams,
  SearchContentQueryParams,
  SetJourneyProgressBody,
  SetReadingPlanBody,
  UpdateProgressBody,
} from "@workspace/api-zod";
import {
  getBooks,
  getChapter,
  getEvent,
  getEvents,
  getJourney,
  getJourneySummaries,
  getPeople,
  getPerson,
  getPlace,
  getPlaces,
  getProgress,
  getReadingPlan,
  getStats,
  getTimeline,
  getVerseById,
  saveJourneyProgress,
  saveProgress,
  saveReadingPlan,
  searchEvents,
  searchJourneys,
  searchPeople,
  searchPlaces,
  searchVerses,
} from "../data/christ-scroll";
import { askPassage, explainPassage } from "../lib/ai";

const router: IRouter = Router();

const VISITOR_COOKIE = "cts_visitor_id";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

function getOrCreateVisitorId(req: Request, res: Response): string {
  const existing = req.cookies?.[VISITOR_COOKIE];
  if (typeof existing === "string" && existing.length > 0) return existing;
  const id = randomUUID();
  res.cookie(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_MS,
  });
  return id;
}

// Signed-in users' data is keyed by their account id; guests get a persistent anonymous cookie instead.
function getOwnerId(req: Request, res: Response): string {
  return req.userId ?? getOrCreateVisitorId(req, res);
}

// The AI endpoints proxy to a paid model, so an unauthenticated caller must not be able to run
// up usage by hammering them. Throttle per-visitor (falling back to IP if cookies are blocked).
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => getOrCreateVisitorId(req, res),
  message: { error: "Too many AI requests. Please wait a moment and try again." },
});

router.get("/books", async (_req, res) => res.json(await getBooks()));

router.get("/scripture/:bookSlug/:chapter", async (req, res) => {
  const parsed = GetChapterParams.safeParse({ bookSlug: req.params.bookSlug, chapter: Number(req.params.chapter) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid Scripture reference." });
  const chapter = await getChapter(parsed.data.bookSlug, parsed.data.chapter);
  return chapter ? res.json(chapter) : res.status(404).json({ error: "We couldn't load this passage." });
});

router.get("/scripture/:bookSlug/:chapter/:verse", async (req, res) => {
  const parsed = GetVerseParams.safeParse({
    bookSlug: req.params.bookSlug,
    chapter: Number(req.params.chapter),
    verse: Number(req.params.verse),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid Scripture reference." });
  const chapter = await getChapter(parsed.data.bookSlug, parsed.data.chapter);
  const verse = chapter?.verses.find((item) => item.verse === parsed.data.verse);
  return verse ? res.json(verse) : res.status(404).json({ error: "We couldn't load this verse." });
});

router.get("/explore/verse/:verseId", async (req, res) => {
  const parsed = GetVerseExplorationParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid verse." });
  const verse = await getVerseById(parsed.data.verseId);
  if (!verse) return res.status(404).json({ error: "We couldn't find that verse." });
  const [people, places, events, timeline] = await Promise.all([getPeople(), getPlaces(), getEvents(), getTimeline()]);
  const highlighted = ["baptism-of-jesus", "calling-first-disciples"];
  return res.json({
    verse,
    people: people.slice(0, 5),
    places: places.slice(0, 3),
    events: events.filter((event) => highlighted.includes(event.slug)),
    timeline: timeline.filter((event) => highlighted.includes(event.slug)),
    relatedScripture: ["Matthew 4:18–22", "Luke 5:1–11", "John 1:40–42"],
    context: "Fishing supported families and commerce around first-century Galilee. Jesus' call turns an ordinary working shoreline into the beginning of a world-changing mission.",
    beforeEvent: "Jesus proclaims the kingdom of God in Galilee",
    afterEvent: "Jesus calls James and John",
  });
});

router.get("/people", async (_req, res) => res.json(await getPeople()));
router.get("/people/:slug", async (req, res) => {
  const parsed = GetPersonParams.safeParse(req.params);
  const person = parsed.success ? await getPerson(parsed.data.slug) : null;
  return person ? res.json(person) : res.status(404).json({ error: "We couldn't find that person." });
});

router.get("/places", async (_req, res) => res.json(await getPlaces()));
router.get("/places/:slug", async (req, res) => {
  const parsed = GetPlaceParams.safeParse(req.params);
  const place = parsed.success ? await getPlace(parsed.data.slug) : null;
  return place ? res.json(place) : res.status(404).json({ error: "We couldn't find that location." });
});

router.get("/events", async (_req, res) => res.json(await getEvents()));
router.get("/events/:slug", async (req, res) => {
  const event = await getEvent(req.params.slug);
  return event ? res.json(event) : res.status(404).json({ error: "We couldn't find that event." });
});

router.get("/timeline", async (_req, res) => res.json(await getTimeline()));
router.get("/journeys", async (_req, res) => res.json(await getJourneySummaries()));
router.get("/journeys/:slug", async (req, res) => {
  const parsed = GetJourneyParams.safeParse(req.params);
  const journey = parsed.success ? await getJourney(parsed.data.slug) : null;
  return journey ? res.json(journey) : res.status(404).json({ error: "Journey not found." });
});
router.put("/journeys/:slug/progress", async (req, res) => {
  const params = GetJourneyParams.safeParse(req.params);
  const body = SetJourneyProgressBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid journey progress." });
  const ownerId = getOwnerId(req, res);
  await saveJourneyProgress(ownerId, params.data.slug, body.data.currentStopIndex);
  return res.status(204).send();
});

router.get("/search", async (req, res) => {
  const parsed = SearchContentQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Enter at least two characters." });
  const q = parsed.data.q;
  const [scripture, people, places, events, journeys] = await Promise.all([
    searchVerses(q),
    searchPeople(q),
    searchPlaces(q),
    searchEvents(q),
    searchJourneys(q),
  ]);
  return res.json({ scripture, people, places, events, journeys });
});

router.post("/ai/explain", aiRateLimiter, async (req, res) => {
  const parsed = ExplainPassageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid passage is required." });
  const ai = await explainPassage(parsed.data.reference, parsed.data.passage);
  return res.json({
    reference: parsed.data.reference,
    scripture: parsed.data.passage,
    simpleWords:
      ai?.simpleWords ??
      "Jesus calls ordinary people in the middle of ordinary work. Their immediate response shows that following him reshapes priorities, identity, and purpose.",
    whyItMatters:
      ai?.whyItMatters ?? "This moment begins a community of disciples who will learn from Jesus and carry his message beyond Galilee.",
    sources: [{ label: "Current passage", reference: parsed.data.reference }, { label: "Parallel account", reference: "Matthew 4:18–22" }],
    label: "AI-assisted explanation",
  });
});

router.post("/ai/ask-passage", aiRateLimiter, async (req, res) => {
  const parsed = AskPassageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid question and passage are required." });
  const ai = await askPassage(parsed.data.question, parsed.data.reference, parsed.data.passage);
  return res.json({
    shortAnswer: ai?.shortAnswer ?? "The passage shows Jesus beginning his public work by calling people to follow him and share in his mission.",
    scripture: [parsed.data.reference, "Matthew 4:18–22", "Luke 5:1–11"],
    context: ai?.context ?? "The call takes place beside the Sea of Galilee after Jesus begins proclaiming the kingdom of God.",
    explanation:
      ai?.explanation ??
      `Your question was: “${parsed.data.question}” The answer is grounded in the current passage and its parallel Gospel accounts rather than presented as a quotation from Scripture.`,
    exploreNext: ai?.exploreNext ?? ["Simon Peter", "Sea of Galilee", "Calling of the First Disciples"],
    sources: [{ label: "Current passage", reference: parsed.data.reference }, { label: "Related Scripture", reference: "Luke 5:1–11" }],
    label: "AI-assisted answer",
  });
});

router.get("/me/progress", async (req, res) => {
  const ownerId = getOwnerId(req, res);
  return res.json(GetProgressResponse.parse(await getProgress(ownerId)));
});
router.patch("/me/progress", async (req, res) => {
  const parsed = UpdateProgressBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid progress." });
  const ownerId = getOwnerId(req, res);
  return res.json(await saveProgress(ownerId, parsed.data));
});

router.get("/me/stats", async (req, res) => {
  const ownerId = getOwnerId(req, res);
  return res.json(GetStatsResponse.parse(await getStats(ownerId)));
});

router.get("/me/plan", async (req, res) => {
  const ownerId = getOwnerId(req, res);
  const plan = await getReadingPlan(ownerId);
  return plan ? res.json(GetReadingPlanResponse.parse(plan)) : res.status(404).json({ error: "No reading plan set." });
});
router.put("/me/plan", async (req, res) => {
  const parsed = SetReadingPlanBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A book and a daily reading goal are required." });
  const ownerId = getOwnerId(req, res);
  return res.json(await saveReadingPlan(ownerId, parsed.data.bookSlug, parsed.data.dailyMinutes));
});

export default router;
