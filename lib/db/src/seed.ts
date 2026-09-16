import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "./index";
import {
  booksTable,
  versesTable,
  peopleTable,
  placesTable,
  eventsTable,
  journeysTable,
  journeyStopsTable,
  type InsertBook,
  type InsertVerse,
} from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Full King James Version text (66 books, 1,189 chapters, 31,100 verses).
// See ./data/KJV-SOURCE.md for provenance and license.
type KjvBook = { name: string; abbrev: string; chapters: string[][] };
const kjvBooks: KjvBook[] = JSON.parse(readFileSync(path.join(__dirname, "data/kjv.json"), "utf-8").replace(/^﻿/, ""));

const rawBooks: Array<[string, string, "old" | "new", string, number]> = [
  ["genesis", "Genesis", "old", "Law", 50], ["exodus", "Exodus", "old", "Law", 40],
  ["leviticus", "Leviticus", "old", "Law", 27], ["numbers", "Numbers", "old", "Law", 36],
  ["deuteronomy", "Deuteronomy", "old", "Law", 34], ["joshua", "Joshua", "old", "History", 24],
  ["judges", "Judges", "old", "History", 21], ["ruth", "Ruth", "old", "History", 4],
  ["1-samuel", "1 Samuel", "old", "History", 31], ["2-samuel", "2 Samuel", "old", "History", 24],
  ["1-kings", "1 Kings", "old", "History", 22], ["2-kings", "2 Kings", "old", "History", 25],
  ["1-chronicles", "1 Chronicles", "old", "History", 29], ["2-chronicles", "2 Chronicles", "old", "History", 36],
  ["ezra", "Ezra", "old", "History", 10], ["nehemiah", "Nehemiah", "old", "History", 13],
  ["esther", "Esther", "old", "History", 10], ["job", "Job", "old", "Poetry / Wisdom", 42],
  ["psalms", "Psalms", "old", "Poetry / Wisdom", 150], ["proverbs", "Proverbs", "old", "Poetry / Wisdom", 31],
  ["ecclesiastes", "Ecclesiastes", "old", "Poetry / Wisdom", 12], ["song-of-solomon", "Song of Solomon", "old", "Poetry / Wisdom", 8],
  ["isaiah", "Isaiah", "old", "Major Prophets", 66], ["jeremiah", "Jeremiah", "old", "Major Prophets", 52],
  ["lamentations", "Lamentations", "old", "Major Prophets", 5], ["ezekiel", "Ezekiel", "old", "Major Prophets", 48],
  ["daniel", "Daniel", "old", "Major Prophets", 12], ["hosea", "Hosea", "old", "Minor Prophets", 14],
  ["joel", "Joel", "old", "Minor Prophets", 3], ["amos", "Amos", "old", "Minor Prophets", 9],
  ["obadiah", "Obadiah", "old", "Minor Prophets", 1], ["jonah", "Jonah", "old", "Minor Prophets", 4],
  ["micah", "Micah", "old", "Minor Prophets", 7], ["nahum", "Nahum", "old", "Minor Prophets", 3],
  ["habakkuk", "Habakkuk", "old", "Minor Prophets", 3], ["zephaniah", "Zephaniah", "old", "Minor Prophets", 3],
  ["haggai", "Haggai", "old", "Minor Prophets", 2], ["zechariah", "Zechariah", "old", "Minor Prophets", 14],
  ["malachi", "Malachi", "old", "Minor Prophets", 4], ["matthew", "Matthew", "new", "Gospels", 28],
  ["mark", "Mark", "new", "Gospels", 16], ["luke", "Luke", "new", "Gospels", 24],
  ["john", "John", "new", "Gospels", 21], ["acts", "Acts", "new", "History", 28],
  ["romans", "Romans", "new", "Pauline Letters", 16], ["1-corinthians", "1 Corinthians", "new", "Pauline Letters", 16],
  ["2-corinthians", "2 Corinthians", "new", "Pauline Letters", 13], ["galatians", "Galatians", "new", "Pauline Letters", 6],
  ["ephesians", "Ephesians", "new", "Pauline Letters", 6], ["philippians", "Philippians", "new", "Pauline Letters", 4],
  ["colossians", "Colossians", "new", "Pauline Letters", 4], ["1-thessalonians", "1 Thessalonians", "new", "Pauline Letters", 5],
  ["2-thessalonians", "2 Thessalonians", "new", "Pauline Letters", 3], ["1-timothy", "1 Timothy", "new", "Pauline Letters", 6],
  ["2-timothy", "2 Timothy", "new", "Pauline Letters", 4], ["titus", "Titus", "new", "Pauline Letters", 3],
  ["philemon", "Philemon", "new", "Pauline Letters", 1], ["hebrews", "Hebrews", "new", "General Letters", 13],
  ["james", "James", "new", "General Letters", 5], ["1-peter", "1 Peter", "new", "General Letters", 5],
  ["2-peter", "2 Peter", "new", "General Letters", 3], ["1-john", "1 John", "new", "General Letters", 5],
  ["2-john", "2 John", "new", "General Letters", 1], ["3-john", "3 John", "new", "General Letters", 1],
  ["jude", "Jude", "new", "General Letters", 1], ["revelation", "Revelation", "new", "Prophecy", 22],
];

const rawPeople: Array<[string, string, string]> = [
  ["jesus", "Jesus", "Messiah • Son of God"], ["simon-peter", "Simon Peter", "Disciple • Apostle"],
  ["andrew", "Andrew", "Disciple • Brother of Peter"], ["james", "James", "Disciple • Son of Zebedee"],
  ["john-apostle", "John", "Disciple • Son of Zebedee"], ["john-baptist", "John the Baptist", "Prophet • Forerunner"],
  ["mary", "Mary", "Mother of Jesus"], ["joseph", "Joseph", "Husband of Mary"],
  ["moses", "Moses", "Prophet • Leader of the Exodus"], ["abraham", "Abraham", "Patriarch • Man of faith"],
  ["sarah", "Sarah", "Matriarch • Wife of Abraham"], ["david", "David", "King • Psalmist"],
  ["solomon", "Solomon", "King • Son of David"], ["elijah", "Elijah", "Prophet"],
  ["isaiah", "Isaiah", "Prophet"], ["paul", "Paul", "Apostle • Missionary"],
  ["barnabas", "Barnabas", "Missionary • Encourager"], ["mary-magdalene", "Mary Magdalene", "Follower of Jesus"],
  ["nicodemus", "Nicodemus", "Pharisee • Teacher of Israel"], ["stephen", "Stephen", "Witness • First martyr"],
];

const rawPlaces: Array<[string, string, string, "known" | "approximate" | "disputed" | "traditional"]> = [
  ["sea-of-galilee", "Sea of Galilee", "Galilee", "known"], ["capernaum", "Capernaum", "Galilee", "known"],
  ["nazareth", "Nazareth", "Galilee", "known"], ["jordan-river", "Jordan River", "Jordan Valley", "approximate"],
  ["jerusalem", "Jerusalem", "Judea", "known"], ["bethlehem", "Bethlehem", "Judea", "known"],
  ["samaria", "Samaria", "Central hill country", "known"], ["judean-wilderness", "Judean Wilderness", "Judea", "approximate"],
  ["mount-sinai", "Mount Sinai", "Sinai region", "disputed"], ["egypt", "Egypt", "Nile region", "known"],
  ["midian", "Midian", "Northwestern Arabia", "approximate"], ["red-sea", "Red Sea", "Egypt and Sinai", "disputed"],
  ["mount-of-olives", "Mount of Olives", "Jerusalem", "known"], ["bethany", "Bethany", "Judea", "traditional"],
  ["damascus", "Damascus", "Syria", "known"], ["antioch", "Antioch", "Syria", "known"],
  ["ephesus", "Ephesus", "Asia Minor", "known"], ["corinth", "Corinth", "Achaia", "known"],
  ["rome", "Rome", "Italy", "known"], ["patmos", "Patmos", "Aegean Sea", "known"],
];

const placeCoordinates: Record<string, [number, number]> = {
  "sea-of-galilee": [32.833, 35.583], capernaum: [32.881, 35.575], nazareth: [32.7, 35.3],
  jerusalem: [31.778, 35.235], bethlehem: [31.705, 35.202], damascus: [33.513, 36.292],
};

const rawEvents: Array<[string, string, string, string]> = [
  ["creation", "Creation", "God creates the heavens and the earth.", "Beginnings"],
  ["call-of-abraham", "Call of Abraham", "God calls Abram to leave his country and go to a promised land.", "Patriarchs"],
  ["the-exodus", "The Exodus", "God delivers Israel from slavery in Egypt.", "Exodus"],
  ["giving-of-the-law", "Giving of the Law", "Israel receives the covenant at Sinai.", "Wilderness"],
  ["david-anointed", "David Anointed", "David is chosen and anointed as king.", "United Kingdom"],
  ["birth-of-jesus", "Birth of Jesus", "Jesus is born in Bethlehem.", "Life of Jesus"],
  ["baptism-of-jesus", "Baptism of Jesus", "Jesus is baptized by John in the Jordan.", "Early Galilean Ministry"],
  ["calling-first-disciples", "Calling of the First Disciples", "Jesus calls Simon, Andrew, James, and John.", "Early Galilean Ministry"],
  ["sermon-on-the-mount", "Sermon on the Mount", "Jesus teaches about life in the kingdom of heaven.", "Galilean Ministry"],
  ["transfiguration", "The Transfiguration", "Jesus is revealed in glory before three disciples.", "Life of Jesus"],
  ["crucifixion", "The Crucifixion", "Jesus is crucified at Jerusalem.", "Passion Week"],
  ["resurrection", "The Resurrection", "Jesus rises from the dead.", "Resurrection"],
  ["pentecost", "Pentecost", "The Holy Spirit is poured out on the gathered disciples.", "Early Church"],
  ["conversion-of-paul", "Conversion of Paul", "Saul encounters the risen Jesus on the road to Damascus.", "Early Church"],
  ["pauls-first-journey", "Paul's First Journey", "Paul and Barnabas carry the gospel across the eastern Mediterranean.", "Missionary Journeys"],
];

const journeyStops: Array<[string, string, string, string[], string]> = [
  ["The Hidden Years", "Nazareth", "Jesus grows in wisdom and stature.", ["Luke 2:39–52"], "nazareth"],
  ["The Jordan", "Jordan Region", "Jesus is baptized and begins his public ministry.", ["Mark 1:9–11"], "jordan-river"],
  ["Into Galilee", "Galilee", "Jesus proclaims the kingdom of God.", ["Mark 1:14–15"], "sea-of-galilee"],
  ["The First Disciples", "Sea of Galilee", "Jesus calls fishermen to follow him.", ["Mark 1:16–20"], "sea-of-galilee"],
  ["A Town Astounded", "Capernaum", "Jesus teaches and heals with authority.", ["Mark 1:21–34"], "capernaum"],
  ["Through Samaria", "Samaria", "Jesus speaks with a woman beside Jacob's well.", ["John 4:4–42"], "samaria"],
  ["Toward Jerusalem", "Judea", "The journey turns toward the city and the cross.", ["Luke 9:51"], "jerusalem"],
  ["Passion and Promise", "Jerusalem", "The cross and resurrection stand at the center of the story.", ["John 19–20"], "jerusalem"],
];

async function seed() {
  const books: InsertBook[] = rawBooks.map(([slug, name, testament, category, chapterCount], index) => ({
    slug, name, testament, category, chapterCount, sortOrder: index,
  }));
  await db.insert(booksTable).values(books).onConflictDoNothing();

  // kjvBooks and `books` are both in canonical Bible order (verified against
  // book names and chapter counts when the dataset was added), so we zip by
  // index rather than matching by name.
  const verses: InsertVerse[] = books.flatMap((book, bookIndex) => {
    const kjvBook = kjvBooks[bookIndex];
    if (!kjvBook) return [];
    return kjvBook.chapters.flatMap((chapterVerses, chapterIndex) => {
      const chapter = chapterIndex + 1;
      return chapterVerses.map((text, verseIndex) => {
        const verse = verseIndex + 1;
        return {
          id: `${book.slug}-${chapter}-${verse}`,
          bookSlug: book.slug,
          chapter,
          verse,
          text,
          reference: `${book.name} ${chapter}:${verse}`,
          translation: "KJV",
        };
      });
    });
  });

  const VERSE_BATCH_SIZE = 2000;
  for (let i = 0; i < verses.length; i += VERSE_BATCH_SIZE) {
    await db.insert(versesTable).values(verses.slice(i, i + VERSE_BATCH_SIZE)).onConflictDoNothing();
  }

  const people = rawPeople.map(([slug, name, role], index) => ({
    slug, name, role,
    description: `${name} is connected to key moments in the biblical story. Explore the passages, places, and events associated with this life.`,
    scriptureReferences: slug === "simon-peter" ? ["Mark 1:16–18", "Matthew 16:13–20", "John 21:15–19"] : ["Selected Scripture"],
    sortOrder: index,
  }));
  await db.insert(peopleTable).values(people).onConflictDoNothing();

  const places = rawPlaces.map(([slug, name, region, confidence], index) => {
    const [latitude, longitude] = placeCoordinates[slug] ?? [31.9, 35.2];
    return {
      slug, name, region, confidence,
      ancientName: name,
      latitude, longitude,
      historicalNotes: `${name} connects geography directly to the biblical narrative. Location confidence is shown so archaeological uncertainty is not presented as settled fact.`,
      scriptureReferences: ["Mark 1:16–20", "Selected Scripture"],
      sortOrder: index,
    };
  });
  await db.insert(placesTable).values(places).onConflictDoNothing();

  const events = rawEvents.map(([slug, name, summary, period], index) => ({
    slug, name, summary, period,
    dateLabel: index < 5 ? "Traditional chronology • date uncertain" : index < 11 ? "First century" : "c. AD 30–50",
    scriptureReferences: index === 0 ? ["Genesis 1:1–5"] : index === 7 ? ["Mark 1:16–20", "Matthew 4:18–22"] : ["Selected Scripture"],
    before: "The story prepares for this moment",
    after: "The story continues into a new chapter",
    sortOrder: index,
  }));
  await db.insert(eventsTable).values(events).onConflictDoNothing();

  await db.insert(journeysTable).values({
    slug: "walk-with-jesus",
    title: "Walk With Jesus",
    subtitle: "Follow the places and passages of Jesus' ministry",
    durationLabel: "8 stops • self-paced",
  }).onConflictDoNothing();

  const stops = journeyStops.map(([title, location, description, scriptureReferences, placeSlug], index) => ({
    journeySlug: "walk-with-jesus",
    sortOrder: index,
    title, location, description, scriptureReferences, placeSlug,
  }));
  await db.insert(journeyStopsTable).values(stops).onConflictDoNothing();

  console.log(`Seeded ${books.length} books, ${verses.length} verses, ${people.length} people, ${places.length} places, ${events.length} events, 1 journey with ${stops.length} stops.`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
