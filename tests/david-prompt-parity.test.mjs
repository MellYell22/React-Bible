import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const chat = read('api', 'chat.ts');
const persona = read('src', 'constants', 'persona.ts');

/**
 * Voice and typed chat used to run on two different personas. persona.ts
 * reached typed chat only, while live voice ran a self-contained prompt in
 * api/chat.ts that still told David to "default to curiosity before advice" --
 * the exact repeated-questioning persona.ts had been rewritten to stop.
 *
 * These tests exist so the two Davids cannot drift apart again silently.
 */

test('both surfaces build from the same system prompt', () => {
  assert.ok(
    !chat.includes('DAVID_LIVE_VOICE_CORE'),
    'live voice must not have its own standalone persona; it drifts from persona.ts',
  );

  // Exactly one prompt builder call, shared by both modes.
  const builderCalls = chat.match(/buildDavidSystemPromptFromGuidance\(/g) || [];
  assert.equal(
    builderCalls.length,
    1,
    'voice and typed chat must call the same prompt builder exactly once',
  );

  // The only thing voice may add is the delivery addendum.
  assert.match(
    chat,
    /liveVoice \? DAVID_VOICE_DELIVERY : ''/,
    'voice must differ from typed chat by the delivery addendum alone',
  );
});

test('the curiosity-first instruction is gone from the voice path', () => {
  // These are the lines that produced the interview behaviour.
  const banned = [
    'Default to curiosity before advice',
    'One honest question is often the whole reply',
    'Let the person explain first. Bring in Scripture when it actually fits',
  ];
  for (const phrase of banned) {
    assert.ok(!chat.includes(phrase), `api/chat.ts still contains curiosity-first rule: "${phrase}"`);
  }
});

test('voice inherits the behavioural rules, not just the tone', () => {
  // Every one of these lives in persona.ts and now reaches speech.
  for (const section of ['THE TURN', 'THE CENTER MOVES', 'RHYTHM', 'MICRO-REACTIONS', 'MEMORY']) {
    assert.ok(persona.includes(section), `persona.ts is missing the ${section} section`);
  }

  // THE TURN is what makes Scripture arrive on time; the voice addendum must
  // reference the same rule rather than inventing a second version of it.
  assert.ok(
    chat.includes('THE TURN'),
    'the voice addendum must point at THE TURN, which now actually reaches it',
  );
});

test('the voice addendum governs delivery only', () => {
  const start = chat.indexOf('VOICE MODE - this reply will be spoken aloud:');
  assert.ok(start > -1, 'voice addendum is missing');
  const body = chat.slice(start, chat.indexOf('`;', start));

  // It must defer to the persona rather than restate or override behaviour.
  assert.ok(
    /Everything above still governs you/.test(body),
    'the addendum must defer to the shared persona explicitly',
  );
  assert.ok(
    /where it is silent, the persona above decides/i.test(body),
    'the addendum must name the persona as the fallback authority',
  );
});

test('spoken replies never carry the verse tracking footer', () => {
  // [VERSE USED: ...] is an internal tag. Read aloud it is gibberish.
  assert.match(
    chat,
    /includeVerseFooter:\s*!stream && !liveVoice/,
    'the verse footer must be suppressed for live voice',
  );
});

test('filler sounds stay banned in typed chat and allowed sparingly in speech', () => {
  // Written text is read, not heard, so "mm" looks odd on screen. Aloud it is
  // how a listening person actually sounds -- persona.ts MICRO-REACTIONS wants
  // it, and the two rules must not contradict each other now they share a file.
  assert.ok(
    /No filler sounds in this typed reply/.test(chat),
    'typed chat must still ban filler sounds',
  );
  const start = chat.indexOf('VOICE MODE - this reply will be spoken aloud:');
  const body = chat.slice(start, chat.indexOf('`;', start));
  assert.ok(
    /natural aloud where it would look odd typed/.test(body),
    'voice must permit a sparing spoken reaction rather than banning it outright',
  );
  assert.ok(
    /at most one, never two turns running/.test(body),
    'the spoken reaction must stay bounded',
  );
});
