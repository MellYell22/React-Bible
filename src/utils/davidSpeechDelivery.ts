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

const SCRIPTED_MARKUP_RE =
  /\[(?:soft\s+breath|breath|inhale|exhale|sigh|pause|gentle\s+pause|thoughtful\s+pause|soft\s+chuckle|chuckle|laughs?)\]|\((?:soft\s+breath|breath|inhale|exhale|sigh|pause|gentle\s+pause|thoughtful\s+pause|soft\s+chuckle|chuckle|laughs?)\)|\*(?:soft\s+breath|breath|inhale|exhale|sigh|pause|gentle\s+pause|thoughtful\s+pause|soft\s+chuckle|chuckle|laughs?)\*/gi;

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

const normalizeQuotesAndSpacing = (text: string): string => {
  let t = protectDecimalPoints(text);

  t = t
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([.!?])(?=[^\s.!?'"’”)])/g, '$1 ')
    .trim();

  return restoreDecimalPoints(t);
};

const collapseStackedFiller = (text: string): string =>
  text
    .replace(
      /\b(mm+|hmm+|hm|ah|uh|um|er|oh)\b[\s,.!—–-]*(?=\b(?:mm+|hmm+|hm|ah|uh|um|er|oh)\b)/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.!—–-]+/, '')
    .trim();

const SENTENCE_RE = /[^.!?]+[.!?]+['"’”)]*|[^.!?]+$/g;
const ENDS_WITH_QUESTION = /\?['"’”)]*\s*$/;
const ENDS_SENTENCE = /[.!?]['"’”)]*\s*$/;

const splitSentences = (text: string): string[] =>
  text.match(SENTENCE_RE) ?? [];

const enforceOneBreath = (text: string): string => {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return text;

  const kept: string[] = [];

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    kept.push(sentence);

    if (ENDS_WITH_QUESTION.test(sentence)) break;
    if (kept.length >= 3) break;
  }

  if (kept.length > 1 && !ENDS_SENTENCE.test(kept[kept.length - 1])) {
    kept.pop();
  }

  const trimmed = kept.join(' ').trim();
  return trimmed.length >= 20 ? trimmed : text;
};

const applyContractions = (text: string): string =>
  text
    .replace(/\bI am\b/g, "I'm")
    .replace(/\bYou are\b/g, "You're")
    .replace(/\bIt is\b/g, "It's")
    .replace(/\bThat is\b/g, "That's")
    .replace(/\bWe are\b/g, "We're")
    .replace(/\bThey are\b/g, "They're");

const preparePlainText = (text: string): string => {
  let t = text.trim();

  t = t.replace(SCRIPTED_MARKUP_RE, '');
  t = joinLineBreaksConversationally(t);
  t = normalizeQuotesAndSpacing(t);
  t = collapseStackedFiller(t);
  t = applyContractions(t);

  return t.trim();
};

/**
 * Display text stays readable and natural. We do not inject artificial pauses
 * into the text the user sees on screen.
 */
export function humanizeForTts(
  text: string,
  options: HumanizeOptions = {},
): string {
  if (!text) return '';
  if (options.skipHumanize) return text.trim();

  const prepared = preparePlainText(text);

  // Session greetings are already intentionally short. Do not run them through
  // the three-sentence one-breath limiter: an opening such as
  // "Hey... good to see you. I'm David. What's going on with you today?"
  // otherwise gets cut off before the final question because "Hey..." counts
  // as its own sentence.
  if (options.isGreeting) return prepared.trim();

  return enforceOneBreath(prepared).trim();
}

/**
 * David's spoken delivery follows COMPLETE THOUGHTS, not a word-count rule.
 *
 * Important:
 * - Never insert periods every one or two words.
 * - Never split a grammatical phrase just to manufacture a pause.
 * - Ellipses become a light comma-like pause instead of an extra sentence,
 *   which keeps greetings and gentle lead-ins flowing naturally.
 * - Dashes and semicolons become light commas so the voice can keep flowing.
 * - Existing sentence endings remain the main pacing signal.
 */
export function sanitizeForDavidSpeech(text: string): string {
  if (!text) return '';

  let t = preparePlainText(text);
  t = protectDecimalPoints(t);

  // Long/stacked punctuation can create exaggerated, disconnected delivery.
  // Treat an ellipsis as one light pause rather than a new full sentence.
  t = t.replace(/\s*\.{2,}\s*/g, ', ');
  t = t.replace(/!{2,}/g, '!');
  t = t.replace(/\?{2,}/g, '?');

  // Keep internal pauses light and conversational.
  t = t.replace(/\s*[—–]\s*/g, ', ');
  t = t.replace(/\s*[;:]+\s*/g, ', ');
  t = t.replace(/,{2,}/g, ',');

  // Let "I'm David" land as one complete thought without chopping the words
  // around it into artificial micro-pauses.
  t = t.replace(/\bHey,\s*I'm David,\s*/gi, "Hey, I'm David. ");
  t = t.replace(/\bHey\s+I'm David,\s*/gi, "Hey, I'm David. ");

  // Clean punctuation spacing without creating new pauses inside phrases.
  t = t
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([.!?])(?=[^\s.!?'"’”)])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  t = restoreDecimalPoints(t);

  return t.trim();
}

export function prepareDavidTtsPayload(
  text: string,
  options: HumanizeOptions = {},
): PrepareTtsResult {
  const displayText = humanizeForTts(text, options);
  const speechText = options.alreadyPrepared
    ? sanitizeForDavidSpeech(text)
    : sanitizeForDavidSpeech(displayText);

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

  const base = emotionalCue ? 520 : 320;
  const lengthAdjustment = wordCount <= 10 ? 120 : wordCount >= 35 ? -20 : 60;
  const jitter = Math.floor(Math.random() * 140);
  const delayMs = Math.max(260, Math.min(820, base + lengthAdjustment + jitter));

  return new Promise(resolve => setTimeout(resolve, delayMs));
}

export const enhanceSpeechDelivery = (text: string): string =>
  sanitizeForDavidSpeech(humanizeForTts(text));
