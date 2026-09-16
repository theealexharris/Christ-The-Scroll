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

const chapterTexts: Record<string, string[]> = {
  "genesis:1": [
    "In the beginning God created the heaven and the earth.",
    "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
    "And God said, Let there be light: and there was light.",
    "And God saw the light, that it was good: and God divided the light from the darkness.",
    "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.",
  ],
  "matthew:4": [
    "Then was Jesus led up of the Spirit into the wilderness to be tempted of the devil.",
    "And when he had fasted forty days and forty nights, he was afterward an hungred.",
    "And when the tempter came to him, he said, If thou be the Son of God, command that these stones be made bread.",
    "But he answered and said, It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.",
  ],
  "mark:1": [
    "The beginning of the gospel of Jesus Christ, the Son of God;",
    "As it is written in the prophets, Behold, I send my messenger before thy face, which shall prepare thy way before thee.",
    "The voice of one crying in the wilderness, Prepare ye the way of the Lord, make his paths straight.",
    "John did baptize in the wilderness, and preach the baptism of repentance for the remission of sins.",
    "And there went out unto him all the land of Judaea, and they of Jerusalem, and were all baptized of him in the river of Jordan, confessing their sins.",
    "And John was clothed with camel's hair, and with a girdle of a skin about his loins; and he did eat locusts and wild honey;",
    "And preached, saying, There cometh one mightier than I after me, the latchet of whose shoes I am not worthy to stoop down and unloose.",
    "I indeed have baptized you with water: but he shall baptize you with the Holy Ghost.",
    "And it came to pass in those days, that Jesus came from Nazareth of Galilee, and was baptized of John in Jordan.",
    "And straightway coming up out of the water, he saw the heavens opened, and the Spirit like a dove descending upon him:",
    "And there came a voice from heaven, saying, Thou art my beloved Son, in whom I am well pleased.",
    "And immediately the Spirit driveth him into the wilderness.",
    "And he was there in the wilderness forty days, tempted of Satan; and was with the wild beasts; and the angels ministered unto him.",
    "Now after that John was put in prison, Jesus came into Galilee, preaching the gospel of the kingdom of God,",
    "And saying, The time is fulfilled, and the kingdom of God is at hand: repent ye, and believe the gospel.",
    "Now as he walked by the sea of Galilee, he saw Simon and Andrew his brother casting a net into the sea: for they were fishers.",
    "And Jesus said unto them, Come ye after me, and I will make you to become fishers of men.",
    "And straightway they forsook their nets, and followed him.",
    "And when he had gone a little farther thence, he saw James the son of Zebedee, and John his brother, who also were in the ship mending their nets.",
    "And straightway he called them: and they left their father Zebedee in the ship with the hired servants, and went after him.",
  ],
  "luke:2": [
    "And it came to pass in those days, that there went out a decree from Caesar Augustus that all the world should be taxed.",
    "And this taxing was first made when Cyrenius was governor of Syria.",
    "And all went to be taxed, every one into his own city.",
    "And Joseph also went up from Galilee, out of the city of Nazareth, into Judaea, unto the city of David, which is called Bethlehem;",
  ],
  "john:3": [
    "There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:",
    "The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God: for no man can do these miracles that thou doest, except God be with him.",
    "Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.",
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  ],
};

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

  const bookBySlug = new Map(books.map((book) => [book.slug, book]));
  const verses: InsertVerse[] = Object.entries(chapterTexts).flatMap(([key, texts]) => {
    const [bookSlug, chapterRaw] = key.split(":");
    const chapter = Number(chapterRaw);
    const book = bookBySlug.get(bookSlug);
    if (!book) return [];
    return texts.map((text, index) => {
      const verse = index + 1;
      return {
        id: `${bookSlug}-${chapter}-${verse}`,
        bookSlug,
        chapter,
        verse,
        text,
        reference: `${book.name} ${chapter}:${verse}`,
        translation: "KJV",
      };
    });
  });
  await db.insert(versesTable).values(verses).onConflictDoNothing();

  const people = rawPeople.map(([slug, name, role]) => ({
    slug, name, role,
    description: `${name} is connected to key moments in the biblical story. Explore the passages, places, and events associated with this life.`,
    scriptureReferences: slug === "simon-peter" ? ["Mark 1:16–18", "Matthew 16:13–20", "John 21:15–19"] : ["Selected Scripture"],
  }));
  await db.insert(peopleTable).values(people).onConflictDoNothing();

  const places = rawPlaces.map(([slug, name, region, confidence]) => {
    const [latitude, longitude] = placeCoordinates[slug] ?? [31.9, 35.2];
    return {
      slug, name, region, confidence,
      ancientName: name,
      latitude, longitude,
      historicalNotes: `${name} connects geography directly to the biblical narrative. Location confidence is shown so archaeological uncertainty is not presented as settled fact.`,
      scriptureReferences: ["Mark 1:16–20", "Selected Scripture"],
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
