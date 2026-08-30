import test from "node:test";
import assert from "node:assert/strict";

import {
  buildContinuityBriefing,
  describeGap,
  detectTopics,
  extractDetails,
  extractOpeningPhrase,
  extractVerseReferences,
  summarizeTurn,
  toRecentTranscript,
} from "../src/utils/davidContinuity.mjs";

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days) => hoursAgo(days * 24);

/* ---------------- verse tracking ---------------- */

test("verse references are pulled out of what David actually said", () => {
  assert.deepEqual(
    extractVerseReferences("There's a line in Philippians 4:6 I love, and Psalm 23:1 too."),
    ["Philippians 4:6", "Psalm 23:1"],
  );
  assert.deepEqual(extractVerseReferences("1 Peter 5:7 has stuck with me."), ["1 Peter 5:7"]);
  assert.deepEqual(extractVerseReferences("Isaiah 41:10-13 says it plainly."), ["Isaiah 41:10"]);
});

test("ordinary numbers are never mistaken for Scripture", () => {
  assert.deepEqual(extractVerseReferences("My surgery is at 3:15 on Tuesday."), []);
  assert.deepEqual(extractVerseReferences("I woke up at 2:30 again."), []);
});

/* ---------------- opening phrases ---------------- */

test("opening phrases are long enough to tell two replies apart", () => {
  // A bare listener cue is not a fingerprint on its own.
  assert.equal(extractOpeningPhrase("Mm. That's a lot to carry. What happened?"), "Mm. That's a lot to carry.");
  assert.equal(extractOpeningPhrase("Yeah... I get that. Even David wrote psalms about it."), "Yeah... I get that.");
});

test("opening phrase is safe on empty or junk input", () => {
  assert.equal(extractOpeningPhrase(""), "");
  assert.equal(extractOpeningPhrase(undefined), "");
});

/* ---------------- concrete details ---------------- */

test("concrete life details are carried forward", () => {
  const details = extractDetails([
    "my wife is in the hospital again",
    "my boss humiliated me in the meeting",
  ]);
  assert.ok(details.some((d) => d.includes("wife")), "should remember the wife");
  assert.ok(details.some((d) => d.includes("boss")), "should remember the boss");
});

test("details are deduplicated so David does not repeat himself", () => {
  const details = extractDetails(["my dad passed away last month", "my dad passed away last month"]);
  assert.equal(details.length, 1);
});

/* ---------------- topics ---------------- */

test("recurring topics are detected from the user's own words", () => {
  assert.ok(detectTopics("work has been brutal and my boss is impossible").includes("work"));
  assert.ok(detectTopics("I can't sleep at all lately").includes("sleep"));
  assert.deepEqual(detectTopics(""), []);
});

/* ---------------- time gaps ---------------- */

test("time since the last conversation is described the way a person would", () => {
  assert.equal(describeGap(hoursAgo(0.1)).key, "continuing");
  assert.equal(describeGap(hoursAgo(3)).key, "same-day");
  assert.equal(describeGap(daysAgo(1.2)).key, "yesterday");
  assert.equal(describeGap(daysAgo(3)).key, "days");
  assert.equal(describeGap(daysAgo(10)).key, "weeks");
  assert.equal(describeGap(daysAgo(60)).key, "long");
});

test("a missing or broken timestamp never throws", () => {
  assert.equal(describeGap(null), null);
  assert.equal(describeGap("not a date"), null);
});

/* ---------------- per-turn metadata ---------------- */

test("each turn is summarized into the columns memory actually stores", () => {
  const meta = summarizeTurn(
    "my wife is sick and I'm scared",
    "Mm. That's a heavy thing to sit with. There's a line in Psalm 34:18 I keep coming back to.",
  );
  assert.equal(meta.verseUsed, "Psalm 34:18");
  assert.ok(meta.openingPhrase.startsWith("Mm."));
  assert.ok(meta.shortSummary.includes("marriage") || meta.shortSummary.includes("health"));
});

test("a reply with no verse records no verse", () => {
  const meta = summarizeTurn("hey", "Hey — good to see you. What's going on today?");
  assert.equal(meta.verseUsed, null);
});

/* ---------------- the briefing ---------------- */

test("a brand new person gets a first-meeting briefing, never a fake shared past", () => {
  const briefing = buildContinuityBriefing([]);
  assert.match(briefing, /FIRST TIME/);
  assert.match(briefing, /never invent a shared past/i);
});

test("a returning person's briefing carries details, verses and openings forward", () => {
  const rows = [
    {
      user_message: "I'm still scared about my wife",
      david_response: "Yeah. That fear makes sense.",
      opening_phrase: "Yeah. That fear makes sense.",
      verse_used: "Psalm 34:18",
      short_summary: "health — my wife is sick",
      mood_key: "ANXIOUS",
      created_at: daysAgo(2),
    },
    {
      user_message: "my wife is sick and I can't sleep",
      david_response: "Mm. That's a lot. There's a line in Philippians 4:6 I love.",
      opening_phrase: "Mm. That's a lot.",
      verse_used: "Philippians 4:6",
      short_summary: "health — my wife is sick",
      mood_key: "ANXIOUS",
      created_at: daysAgo(3),
    },
  ];

  const briefing = buildContinuityBriefing(rows, { firstName: "Sarah" });

  assert.match(briefing, /talked with them before/i);
  assert.match(briefing, /Sarah/);
  assert.match(briefing, /wife/i, "should carry the wife forward");
  assert.match(briefing, /Psalm 34:18/i, "should list spent verses");
  assert.match(briefing, /Philippians 4:6/i);
  assert.match(briefing, /ANTI-REPETITION/);
  assert.match(briefing, /Openings you already used/i);
});

test("a mid-conversation return is told not to greet again", () => {
  const briefing = buildContinuityBriefing([
    { user_message: "yeah", david_response: "Go on.", created_at: hoursAgo(0.1) },
  ]);
  assert.match(briefing, /Do NOT greet them again/i);
});

test("someone back after a long gap is welcomed without guilt", () => {
  const briefing = buildContinuityBriefing([
    { user_message: "hey", david_response: "Hey.", created_at: daysAgo(40) },
  ]);
  assert.match(briefing, /without guilt-tripping/i);
});

test("the briefing never throws on malformed rows", () => {
  assert.doesNotThrow(() => buildContinuityBriefing([null, {}, { user_message: "hi" }]));
  assert.doesNotThrow(() => buildContinuityBriefing(undefined));
});

/* ---------------- transcript ---------------- */

test("the verbatim transcript is oldest-first and capped", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    user_message: `user ${i}`,
    david_response: `david ${i}`,
    created_at: daysAgo(i),
  }));

  const transcript = toRecentTranscript(rows, 3);
  assert.equal(transcript.length, 6);
  assert.equal(transcript[0].role, "user");
  // Newest row is index 0, so oldest of the kept three should come first.
  assert.equal(transcript[0].content, "user 2");
  assert.equal(transcript[5].content, "david 0");
});
