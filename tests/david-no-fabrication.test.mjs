import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * David's worst failure mode is not being boring — it is being confidently wrong
 * about someone's life. Guessing "school" at a person who never mentioned school
 * breaks trust instantly, and a spiritual companion runs on trust.
 *
 * These tests pin the anti-fabrication rule into every surface that talks to a
 * user: typed chat, live voice, and the verse reflection screen.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

const persona = read("src", "constants", "persona.ts");
const reflection = read("api", "reflection.ts");
const davidChat = read("api", "david-chat.ts");

const GUESSABLE = ["job", "school", "grades", "exams", "boss", "spouse", "partner", "children", "health", "money"];

test("the anti-fabrication rule exists as one shared, exported source of truth", () => {
  assert.match(persona, /export const DAVID_NO_FABRICATION_RULE/);
  assert.match(persona, /NOTHING INVENTED/);
});

test("the rule names the specific details David kept guessing", () => {
  const block = persona.slice(persona.indexOf("DAVID_NO_FABRICATION_RULE"));
  for (const detail of GUESSABLE) {
    assert.match(block, new RegExp(`\\b${detail}\\b`, "i"), `rule never mentions ${detail}`);
  }
});

test("David is told vagueness means ask, not guess", () => {
  assert.match(persona, /Vagueness is an invitation to ask ONE question/i);
  assert.match(persona, /Getting it wrong is worse than not knowing/i);
});

test("invented memories and invented Scripture are both banned", () => {
  assert.match(persona, /Never invent a shared memory/i);
  assert.match(persona, /Never invent a verse, a reference/i);
});

test("the reflection shape is defined: reflect, parallel, verse, explain, ask", () => {
  assert.match(persona, /Reflect ONLY what they actually said/i);
  assert.match(persona, /ONE biblical parallel/i);
  assert.match(persona, /ONE verse that fits/i);
  assert.match(persona, /ONE open-ended question/i);
});

test("the five-part shape is NOT forced onto greetings and small talk", () => {
  assert.match(
    persona,
    /Never do all five when they've only said hello/i,
    "greetings must not trigger a verse and a parallel",
  );
});

test("the chat brain imports the shared rule and puts it last", () => {
  assert.match(davidChat, /DAVID_NO_FABRICATION_RULE/);
  const stack = davidChat.slice(davidChat.indexOf("return ["), davidChat.indexOf(".filter(Boolean)"));
  const rulePos = stack.indexOf("DAVID_NO_FABRICATION_RULE");
  const personaPos = stack.indexOf("DAVID_PERSONA");
  assert.ok(rulePos > personaPos, "the rule must come last so recency protects it");
});

test("continuity notes are framed as a ceiling, not a starting point", () => {
  assert.match(davidChat, /That is the complete list/i);
});

test("the reflection engine knows it has ONLY a verse and no user context", () => {
  assert.match(reflection, /DAVID_NO_FABRICATION_RULE/);
  assert.match(reflection, /you have been given a verse and NOTHING ELSE/i);
  assert.match(reflection, /Never write as though you know their circumstances/i);
});

test("the reflection engine bans the specific invented scenarios", () => {
  for (const phrase of ["when work feels overwhelming", "as you study for exams", "in your marriage", "as a parent"]) {
    assert.ok(
      reflection.includes(phrase),
      `reflection prompt should explicitly ban "${phrase}"`,
    );
  }
});

test("the reflection asks one open question that presumes nothing", () => {
  assert.match(reflection, /ONE open-ended question/i);
  assert.match(reflection, /assumes nothing about their job, school, family, health, or circumstances/i);
});

test("reflection temperature is lowered, since invention scales with it", () => {
  assert.match(reflection, /temperature: 0\.5/);
});
