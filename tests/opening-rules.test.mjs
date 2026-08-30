import test from "node:test";
import assert from "node:assert/strict";

import { buildOpeningRules } from "../src/utils/davidOpeningRules.mjs";

test("no opening produces no rules", () => {
  assert.equal(buildOpeningRules(null), "");
  assert.equal(buildOpeningRules(undefined), "");
  assert.equal(buildOpeningRules(""), "");
});

test("every opening type forbids Scripture this turn", () => {
  for (const opening of ["greeting", "small-talk", "low-signal"]) {
    const rules = buildOpeningRules(opening);
    assert.match(rules, /Scripture/i);
    assert.match(rules, /^THIS TURN IS/);
  }
});

test("the header names the specific opening type", () => {
  assert.match(buildOpeningRules("greeting"), /THIS TURN IS GREETING/);
  assert.match(buildOpeningRules("small-talk"), /THIS TURN IS SMALL-TALK/);
  assert.match(buildOpeningRules("low-signal"), /THIS TURN IS LOW-SIGNAL/);
});

test("small-talk gets its own line, low-signal does not", () => {
  const smallTalk = buildOpeningRules("small-talk");
  assert.match(smallTalk, /They are asking about you/);
  assert.doesNotMatch(smallTalk, /idk.*is not a crisis/);
});

test("low-signal gets its own line, small-talk does not", () => {
  const lowSignal = buildOpeningRules("low-signal");
  assert.match(lowSignal, /idk.*is not a crisis/);
  assert.doesNotMatch(lowSignal, /They are asking about you/);
});

test("plain greeting gets neither special-case line", () => {
  const greeting = buildOpeningRules("greeting");
  assert.doesNotMatch(greeting, /They are asking about you/);
  assert.doesNotMatch(greeting, /idk.*is not a crisis/);
});

test("an unrecognised opening still returns the shared rules, no crash", () => {
  const rules = buildOpeningRules("mystery-type");
  assert.match(rules, /THIS TURN IS MYSTERY-TYPE/);
  assert.match(rules, /Scripture/i);
});
