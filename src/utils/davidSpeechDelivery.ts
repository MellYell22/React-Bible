/**
 * Clean natural delivery for David.
 * Keep speech conversational without artificial fillers or robotic pauses.
 */

export type HumanizeOptions = {
  isGreeting?: boolean;
  force?: boolean;
};

export function humanizeForTts(
  text: string,
  options: HumanizeOptions = {},
): string {
  if (!text) return '';

  let t = text.trim();

  // Light conversational cleanup only
  t = t.replace(/\s+/g, ' ');

  // soften harsh punctuation
  t = t.replace(/!/g, '.');

  // avoid repetitive ellipsis spam
  t = t.replace(/\.{3,}/g, '…');

  return t;
}

export type PrepareTtsResult = {
  displayText: string;
  speechText: string;
};

export function prepareDavidTtsPayload(
  text: string,
  options: HumanizeOptions = {},
): PrepareTtsResult {
  const cleaned = humanizeForTts(text, options);

  return {
    displayText: cleaned,
    speechText: cleaned,
  };
}

/**
 * Remove fake thinking delays.
 * Real conversation should feel responsive.
 */
export function preSpeechThinkingDelay(): Promise<void> {
  return Promise.resolve();
}