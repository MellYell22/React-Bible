import test from "node:test";
import assert from "node:assert/strict";
import { createSentenceStream, splitIntoSentences } from "../src/utils/sentenceStream.mjs";

/** Simulate a model streaming text in small fragments. */
function streamIn(text, chunkSize = 7) {
  const stream = createSentenceStream();
  const emitted = [];
  let sofar = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    sofar += text.slice(i, i + chunkSize);
    emitted.push(...stream.push(sofar));
  }
  emitted.push(...stream.flush());
  return emitted;
}

test("a sentence is emitted as soon as it completes, not at the end", () => {
  const stream = createSentenceStream();
  const first = stream.push("That sounds genuinely exhausting. And then");
  assert.deepEqual(first, ["That sounds genuinely exhausting."]);
});

test("nothing is emitted while a sentence is still forming", () => {
  const stream = createSentenceStream();
  assert.deepEqual(stream.push("There's a line in Philipp"), []);
  assert.deepEqual(stream.push("There's a line in Philippians I love"), []);
});

test("streaming in fragments produces the same result as one shot", () => {
  const text = "That sounds heavy. There's a line in Isaiah I keep coming back to. What happened?";
  assert.deepEqual(streamIn(text), splitIntoSentences(text));
});

test("nothing is ever lost or duplicated across a stream", () => {
  const text = "Yeah, that's hard. Job sat in ash for seven days. What's been the worst part?";
  const joined = streamIn(text, 3).join(" ");
  assert.equal(joined.replace(/\s+/g, " "), text.replace(/\s+/g, " "));
});

test("a verse reference is never split mid-citation", () => {
  for (const t of ["Philippians 4:6 says it plainly.", "Read Psalm 23.1 slowly."]) {
    const parts = splitIntoSentences(t);
    assert.equal(parts.length, 1, `split "${t}" into ${parts.length}`);
  }
});

test("abbreviations and initials do not end a sentence", () => {
  assert.deepEqual(splitIntoSentences("Dr. Luke wrote it."), ["Dr. Luke wrote it."]);
  assert.deepEqual(splitIntoSentences("C. S. Lewis said that."), ["C. S. Lewis said that."]);
  assert.deepEqual(splitIntoSentences("Mr. Smith called."), ["Mr. Smith called."]);
});

test("a short opener rides along instead of becoming its own clip", () => {
  // "Yeah." alone would be a two-word audio file followed by an awkward gap.
  assert.deepEqual(
    splitIntoSentences("Yeah. That's a lot to carry."),
    ["Yeah. That's a lot to carry."],
  );
});

test("ellipses do not fragment a thought", () => {
  assert.deepEqual(splitIntoSentences("Hm... that's a hard one."), ["Hm... that's a hard one."]);
});

test("question and exclamation marks close a sentence", () => {
  assert.deepEqual(
    splitIntoSentences("What happened? Tell me when you're ready."),
    ["What happened?", "Tell me when you're ready."],
  );
});

test("unpunctuated rambling still gets cut at a word boundary", () => {
  const long = "and then " .repeat(60);
  const stream = createSentenceStream({ maxChars: 80 });
  const out = stream.push(long);
  assert.ok(out.length > 0, "should not buffer forever");
  assert.ok(out.every((s) => !s.endsWith("an") && !s.endsWith("the")), "must not clip a word in half");
});

test("flush returns the trailing fragment when the model stops without punctuation", () => {
  const stream = createSentenceStream();
  stream.push("First thought here. Second one trails off");
  assert.deepEqual(stream.flush(), ["Second one trails off"]);
});

test("empty and malformed input never throws", () => {
  assert.deepEqual(splitIntoSentences(""), []);
  assert.deepEqual(splitIntoSentences(undefined), []);
  const s = createSentenceStream();
  assert.deepEqual(s.push(undefined), []);
  assert.deepEqual(s.flush(), []);
});

test("the first spoken chunk arrives well before the full reply is done", () => {
  const full = "That sounds exhausting. There's a line in Isaiah about renewing strength. What's been hardest?";
  const stream = createSentenceStream();
  const firstAt = full.indexOf("exhausting.") + "exhausting.".length;
  const early = stream.push(full.slice(0, firstAt));
  assert.equal(early.length, 1, "David should have something to say a third of the way in");
  assert.ok(firstAt < full.length * 0.45, "first clip should land early in the stream");
});
