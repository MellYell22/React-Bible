export type PrepareTtsResult = {
  displayText: string;
  speechText: string;
};

export type HumanizeOptions = {
  isGreeting?: boolean;
  skipOpener?: boolean;
  skipHumanize?: boolean;
  alreadyPrepared?: boolean;
};

const TRAILING_PAUSE_MARKS = /[\s,;:-]+$/;

const SCRIPTED_MARKUP_RE =
  /\[(?:soft\s+breath|breath|inhale|exhale|sigh|pause)\]|\((?:soft\s+breath|breath|inhale|exhale|sigh|pause)\)|\*(?:soft\s+breath|breath|inhale|exhale|sigh|pause)\*/gi;

const ACKNOWLEDGEMENT_PERIOD_RE =
  /\b(I hear you|I'm with you|I am with you|That feels heavy|That's a lot|That is a lot|I get that|I understand)\.\s+/gi;

const FILLER_PERIOD_RE =
  /\b(mm+|hmm+|hm+|yeah|hey|okay|alright|you know|i mean|well)\.\s+/gi;

const DECIMAL_PLACEHOLDER = '__DAVID_DECIMAL_POINT__';

const protectDecimalPoints = (text: string): string =>
  text.replace(/(\d)\.(\d)/g, `$1${DECIMAL_PLACEHOLDER}$2`);

const restoreDecimalPoints = (text: string): string =>
  text.replaceAll(DECIMAL_PLACEHOLDER, '.');

const joinLineBreaksConversationally = (text: string): string => {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(line => line.replace(/^[\s*\-\d+.)]+/, '').trim())
    .filter(Boolean);

  return lines.length <= 1 ? text : lines.join(' ');
};

const softenPunctuationForTts = (text: string): string => {
  let t = protectDecimalPoints(text);

  t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/\s*[\u2013\u2014]\s*/g, ', ');
  t = t.replace(/\s*[;:]+\s*/g, ', ');
  t = t.replace(/\s+-\s+/g, ', ');
  t = t.replace(/\.{4,}/g, '...');
  t = t.replace(/,{2,}/g, ',');
  t = t.replace(/\s+,/g, ',');
  // Space out run-together sentences, but never wedge a space between a
  // terminator and its closing quote ("...anything.'" must stay intact).
  t = t.replace(/([.!?])(?=[^\s.!?'"’”)])/g, '$1 ');

  return restoreDecimalPoints(t);
};

const softenShortInternalStops = (text: string): string => {
  let t = protectDecimalPoints(text);

  t = t.replace(FILLER_PERIOD_RE, (_match, filler: string) => `${filler}, `);

  t = t.replace(
    ACKNOWLEDGEMENT_PERIOD_RE,
    (_match, phrase: string) => `${phrase}, `,
  );

  t = t.replace(
    /^([^.!?]{2,34})\.\s+(?=[A-Z"'])/u,
    (_match, leadIn: string) => {
      const wordCount = leadIn.trim().split(/\s+/).filter(Boolean).length;

      return wordCount <= 5 ? `${leadIn}, ` : `${leadIn}. `;
    },
  );

  return restoreDecimalPoints(t);
};

const addTinyNaturalBreaths = (text: string): string => {
  let t = text;

  t = t.replace(/\bI'm David, I'm\b/g, "I'm David, and I'm");
  t = t.replace(/\bI'm David\.\s+/g, "I'm David, ");
  t = t.replace(
    /\b(I'm with you|I hear you|That's a lot|That sounds heavy),\s+/gi,
    '$1, ',
  );

  return t;
};

/**
 * Splits into sentences without cutting a Scripture quote in half.
 * Closing quotes stay attached to the sentence they belong to, so
 * "'Do not be anxious about anything.'" never becomes "anything. '".
 */
const SENTENCE_RE = /[^.!?]+[.!?]+['"’”)]*|[^.!?]+$/g;

/** Terminators tolerate a trailing quote: `...with you?"` is still a question. */
const ENDS_WITH_QUESTION = /\?['"’”)]*\s*$/;
const ENDS_SENTENCE = /[.!?]['"’”)]*\s*$/;

const splitSentences = (text: string): string[] =>
  text.match(SENTENCE_RE) ?? [];

/**
 * The one-breath rule, enforced client-side: at most three sentences, and
 * nothing after the first question — David asks once, then stops and waits.
 */
const enforceOneBreath = (text: string): string => {
  const sentenceMatches = splitSentences(text);

  if (sentenceMatches.length <= 1) {
    return text;
  }

  const kept: string[] = [];

  for (const raw of sentenceMatches) {
    const sentence = raw.trim();
    if (!sentence) continue;

    kept.push(sentence);

    // One gentle question per reply — never two in a row.
    if (ENDS_WITH_QUESTION.test(sentence)) break;

    if (kept.length >= 3) break;
  }

  // If the reply was cut off mid-thought, drop the fragment rather than
  // speaking half a sentence aloud.
  if (kept.length > 1 && !ENDS_SENTENCE.test(kept[kept.length - 1])) {
    kept.pop();
  }

  const trimmed = kept.join(' ').trim();

  // Never trade a usable reply for an unusably short fragment.
  return trimmed.length >= 20 ? trimmed : text;
};

/**
 * Single natural cues — "Ah—", "Um—", "Uh—", "Oh" — are allowed through.
 * They read as someone thinking, which is warmer than a clean recital.
 *
 * What is still collapsed is *stacked* filler ("mm, hmm, ah...") — that is
 * the thing that sounds like a machine buffering, not a person pausing.
 */
const collapseStackedFiller = (text: string): string =>
  text
    // Drop any cue that is immediately followed by another cue.
    .replace(
      /\b(mm+|hmm+|hm|ah|uh|um|er|oh)\b[\s,.!—–-]*(?=\b(?:mm+|hmm+|hm|ah|uh|um|er|oh)\b)/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.!—–-]+/, '')
    .trim();

function preparePlainSpeechText(text: string): string {
  let t = text.trim();

  t = t.replace(SCRIPTED_MARKUP_RE, '');

  t = joinLineBreaksConversationally(t);

  t = t.replace(/!{2,}/g, '!');

  t = t.replace(/\s+/g, ' ');

  t = t.replace(/\s+([,.!?])/g, '$1');

  t = softenPunctuationForTts(t);

  t = softenShortInternalStops(t);

  t = addTinyNaturalBreaths(t);

  return t.trim();
}

export function humanizeForTts(
  text: string,
  options: HumanizeOptions = {},
): string {
  if (!text) return '';

  let t = preparePlainSpeechText(text);

  t = collapseStackedFiller(t);

  t = enforceOneBreath(t);

  t = t.replace(/\bI am\b/g, "I'm");
  t = t.replace(/\bYou are\b/g, "You're");
  t = t.replace(/\bIt is\b/g, "It's");
  t = t.replace(/\bThat is\b/g, "That's");
  t = t.replace(/\bWe are\b/g, "We're");
  t = t.replace(/\bThey are\b/g, "They're");

  return t.trim();
}

export function sanitizeForDavidSpeech(text: string): string {
  if (!text) return '';

  let t = preparePlainSpeechText(text);

  // Ellipses make ElevenLabs insert long breathing pauses; keep the beat short.
  t = t.replace(/\s*\.{3}\s*/g, ', ');
  t = t.replace(/,\s*,+/g, ',');

  t = t.replace(TRAILING_PAUSE_MARKS, '');

  return t.trim();
}

export function prepareDavidTtsPayload(
  text: string,
  options: HumanizeOptions = {},
): PrepareTtsResult {
  const displayText = humanizeForTts(text, options);

  const speechText = sanitizeForDavidSpeech(displayText);

  return {
    displayText,
    speechText,
  };
}

export function preSpeechThinkingDelay(text = ''): Promise<void> {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const emotionalCue =
    /\b(anxious|afraid|sad|lonely|guilt|ashamed|overwhelmed|grief|hurt|heavy|panic|worried|tired)\b/i.test(
      text,
    );

  const base = emotionalCue ? 610 : 390;

  const lengthAdjustment =
    wordCount <= 10 ? 230 : wordCount >= 35 ? -30 : 90;

  const jitter = Math.floor(Math.random() * 220);

  const delayMs = Math.max(
    340,
    Math.min(1050, base + lengthAdjustment + jitter),
  );

  return new Promise(resolve => setTimeout(resolve, delayMs));
}

export const enhanceSpeechDelivery = (text: string): string => {
  return sanitizeForDavidSpeech(humanizeForTts(text));
};
