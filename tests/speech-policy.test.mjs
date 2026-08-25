import test from "node:test";
import assert from "node:assert/strict";

import {
  canSpeak,
  SPEECH_SOURCE_VOICE_MODE,
  SPEECH_SOURCE_USER_TAP,
} from "../src/utils/speechPolicy.mjs";

test("typed chat never triggers voice output", () => {
  // An unlabelled speech request is exactly what a text screen would produce.
  for (const voiceModeActive of [false, true]) {
    const verdict = canSpeak({ voiceModeActive });
    assert.equal(verdict.allowed, false, `unlabelled call allowed (voiceMode=${voiceModeActive})`);
  }

  // Anything that is not a recognised source is refused too.
  for (const source of ["chat", "text", "auto", "stream", "", null, undefined, 42, {}]) {
    const verdict = canSpeak({ source, voiceModeActive: true });
    assert.equal(verdict.allowed, false, `source ${JSON.stringify(source)} was allowed`);
  }
});

test("voice mode may speak only while a voice session is active", () => {
  assert.equal(canSpeak({ source: SPEECH_SOURCE_VOICE_MODE, voiceModeActive: true }).allowed, true);
  assert.equal(canSpeak({ source: SPEECH_SOURCE_VOICE_MODE, voiceModeActive: false }).allowed, false);
  // Default is inactive — leaving the voice screen silences David.
  assert.equal(canSpeak({ source: SPEECH_SOURCE_VOICE_MODE }).allowed, false);
});

test("an explicit speaker tap is always allowed", () => {
  assert.equal(canSpeak({ source: SPEECH_SOURCE_USER_TAP, voiceModeActive: false }).allowed, true);
  assert.equal(canSpeak({ source: SPEECH_SOURCE_USER_TAP, voiceModeActive: true }).allowed, true);
});

test("every refusal explains itself", () => {
  const refusals = [
    canSpeak({}),
    canSpeak({ source: "chat" }),
    canSpeak({ source: SPEECH_SOURCE_VOICE_MODE, voiceModeActive: false }),
  ];
  for (const r of refusals) {
    assert.equal(r.allowed, false);
    assert.match(r.reason, /Refused/);
  }
});

test("canSpeak never throws, whatever it is given", () => {
  for (const input of [undefined, null, {}, { source: {} }, "string", 0]) {
    assert.doesNotThrow(() => canSpeak(input), `threw for ${JSON.stringify(input)}`);
  }
});
