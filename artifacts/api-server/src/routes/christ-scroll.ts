import { Router, type IRouter } from "express";
import {
  AskPassageBody,
  ExplainPassageBody,
  GetChapterParams,
  GetJourneyParams,
  GetPersonParams,
  GetPlaceParams,
  GetProgressResponse,
  GetVerseExplorationParams,
  GetVerseParams,
  SearchContentQueryParams,
  UpdateProgressBody,
} from "@workspace/api-zod";
import { books, chapterFor, events, journey, people, places, timeline, verseById } from "../data/christ-scroll";

const router: IRouter = Router();
let progress = { bookSlug: "mark", chapter: 1, verse: 16, percent: 12, lastReference: "Mark 1:16" };

router.get("/books", (_req, res) => res.json(books));

router.get("/scripture/:bookSlug/:chapter", (req, res) => {
  const parsed = GetChapterParams.safeParse({ bookSlug: req.params.bookSlug, chapter: Number(req.params.chapter) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid Scripture reference." });
  const chapter = chapterFor(parsed.data.bookSlug, parsed.data.chapter);
  return chapter ? res.json(chapter) : res.status(404).json({ error: "We couldn't load this passage." });
});

router.get("/scripture/:bookSlug/:chapter/:verse", (req, res) => {
  const parsed = GetVerseParams.safeParse({
    bookSlug: req.params.bookSlug,
    chapter: Number(req.params.chapter),
    verse: Number(req.params.verse),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid Scripture reference." });
  const verse = chapterFor(parsed.data.bookSlug, parsed.data.chapter)?.verses.find((item) => item.verse === parsed.data.verse);
  return verse ? res.json(verse) : res.status(404).json({ error: "We couldn't load this verse." });
});

router.get("/explore/verse/:verseId", (req, res) => {
  const parsed = GetVerseExplorationParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid verse." });
  const verse = verseById(parsed.data.verseId);
  return res.json({
    verse,
    people: people.slice(0, 5),
    places: places.slice(0, 3),
    events: events.filter((event) => ["baptism-of-jesus", "calling-first-disciples"].includes(event.slug)),
    timeline: timeline.filter((event) => ["baptism-of-jesus", "calling-first-disciples"].includes(event.slug)),
    relatedScripture: ["Matthew 4:18–22", "Luke 5:1–11", "John 1:40–42"],
    context: "Fishing supported families and commerce around first-century Galilee. Jesus' call turns an ordinary working shoreline into the beginning of a world-changing mission.",
    beforeEvent: "Jesus proclaims the kingdom of God in Galilee",
    afterEvent: "Jesus calls James and John",
  });
});

router.get("/people", (_req, res) => res.json(people));
router.get("/people/:slug", (req, res) => {
  const parsed = GetPersonParams.safeParse(req.params);
  const person = parsed.success && people.find((item) => item.slug === parsed.data.slug);
  if (!person) return res.status(404).json({ error: "We couldn't find that person." });
  return res.json({
    ...person,
    scriptureReferences: person.slug === "simon-peter" ? ["Mark 1:16–18", "Matthew 16:13–20", "John 21:15–19"] : ["Selected Scripture"],
    places: places.slice(0, 4),
    events: events.slice(6, 10),
    timeline: timeline.slice(6, 10),
  });
});

router.get("/places", (_req, res) => res.json(places));
router.get("/places/:slug", (req, res) => {
  const parsed = GetPlaceParams.safeParse(req.params);
  const place = parsed.success && places.find((item) => item.slug === parsed.data.slug);
  if (!place) return res.status(404).json({ error: "We couldn't find that location." });
  const coordinates: Record<string, [number, number]> = {
    "sea-of-galilee": [32.833, 35.583], capernaum: [32.881, 35.575], nazareth: [32.7, 35.3],
    jerusalem: [31.778, 35.235], bethlehem: [31.705, 35.202], damascus: [33.513, 36.292],
  };
  const [latitude, longitude] = coordinates[place.slug] ?? [31.9, 35.2];
  return res.json({
    ...place,
    ancientName: place.name,
    latitude,
    longitude,
    historicalNotes: `${place.name} connects geography directly to the biblical narrative. Location confidence is shown so archaeological uncertainty is not presented as settled fact.`,
    scriptureReferences: ["Mark 1:16–20", "Selected Scripture"],
    people: people.slice(0, 5),
    events: events.slice(6, 10),
  });
});

router.get("/events", (_req, res) => res.json(events));
router.get("/events/:slug", (req, res) => {
  const event = events.find((item) => item.slug === req.params.slug);
  if (!event) return res.status(404).json({ error: "We couldn't find that event." });
  return res.json({
    ...event,
    scriptureReferences: event.slug === "calling-first-disciples" ? ["Mark 1:16–20", "Matthew 4:18–22", "Luke 5:1–11"] : ["Selected Scripture"],
    people: people.slice(0, 5), places: places.slice(0, 3),
    before: "The story prepares for this moment", after: "The story continues into a new chapter",
  });
});

router.get("/timeline", (_req, res) => res.json(timeline));
router.get("/journeys", (_req, res) => res.json([{ slug: journey.slug, title: journey.title, subtitle: journey.subtitle, stopCount: journey.stopCount, durationLabel: journey.durationLabel }]));
router.get("/journeys/:slug", (req, res) => {
  const parsed = GetJourneyParams.safeParse(req.params);
  return parsed.success && parsed.data.slug === journey.slug ? res.json(journey) : res.status(404).json({ error: "Journey not found." });
});

router.get("/search", (req, res) => {
  const parsed = SearchContentQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Enter at least two characters." });
  const q = parsed.data.q.toLowerCase();
  const scripture = ["john 3:16", "mark 1:16", "genesis 1:1"].flatMap((reference) => {
    const [book, location] = reference.split(" ");
    const [chapter, verse] = location.split(":").map(Number);
    const item = chapterFor(book, chapter)?.verses.find((candidate) => candidate.verse === verse);
    return item && `${item.reference} ${item.text}`.toLowerCase().includes(q) ? [item] : [];
  });
  const includes = <T extends { name?: string; title?: string; summary?: string }>(item: T) =>
    `${item.name ?? ""} ${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase().includes(q);
  return res.json({
    scripture, people: people.filter(includes), places: places.filter(includes), events: events.filter(includes),
    journeys: includes(journey) ? [{ slug: journey.slug, title: journey.title, subtitle: journey.subtitle, stopCount: journey.stopCount, durationLabel: journey.durationLabel }] : [],
  });
});

router.post("/ai/explain", (req, res) => {
  const parsed = ExplainPassageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid passage is required." });
  return res.json({
    reference: parsed.data.reference,
    scripture: parsed.data.passage,
    simpleWords: "Jesus calls ordinary people in the middle of ordinary work. Their immediate response shows that following him reshapes priorities, identity, and purpose.",
    whyItMatters: "This moment begins a community of disciples who will learn from Jesus and carry his message beyond Galilee.",
    sources: [{ label: "Current passage", reference: parsed.data.reference }, { label: "Parallel account", reference: "Matthew 4:18–22" }],
    label: "AI-assisted explanation",
  });
});

router.post("/ai/ask-passage", (req, res) => {
  const parsed = AskPassageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid question and passage are required." });
  return res.json({
    shortAnswer: "The passage shows Jesus beginning his public work by calling people to follow him and share in his mission.",
    scripture: [parsed.data.reference, "Matthew 4:18–22", "Luke 5:1–11"],
    context: "The call takes place beside the Sea of Galilee after Jesus begins proclaiming the kingdom of God.",
    explanation: `Your question was: “${parsed.data.question}” The answer is grounded in the current passage and its parallel Gospel accounts rather than presented as a quotation from Scripture.`,
    exploreNext: ["Simon Peter", "Sea of Galilee", "Calling of the First Disciples"],
    sources: [{ label: "Current passage", reference: parsed.data.reference }, { label: "Related Scripture", reference: "Luke 5:1–11" }],
    label: "AI-assisted answer",
  });
});

router.get("/me/progress", (_req, res) => res.json(GetProgressResponse.parse(progress)));
router.patch("/me/progress", (req, res) => {
  const parsed = UpdateProgressBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid progress." });
  progress = parsed.data;
  return res.json(progress);
});

export default router;
