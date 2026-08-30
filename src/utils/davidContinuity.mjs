/**
 * David's continuity layer.
 *
 * The problem this solves: David had a memory *table* but no memory *sense*.
 * Every session he re-met the user, re-introduced himself, reached for the
 * same openers, and re-offered encouragement he had already given. Users
 * described it as "the same conversation every day."
 *
 * This module turns raw stored turns into a short briefing David reads before
 * he speaks — how long it's been, what keeps coming back, what concrete
 * details the person trusted him with, and what he has already said so he
 * doesn't say it again.
 *
 * Deliberately plain string work, not a model call: this runs on every turn
 * and must be fast, free, and predictable.
 */

/* ------------------------------------------------------------------ *
 * Small shared helpers
 * ------------------------------------------------------------------ */

const collapse = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const unique = (values) => [...new Set(values.filter(Boolean))];

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/* ------------------------------------------------------------------ *
 * Verse references
 * ------------------------------------------------------------------ */

/**
 * Books are listed explicitly rather than matched loosely, so a sentence like
 * "Tuesday 3:15" can never be mistaken for Scripture.
 */
const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes',
  'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea',
  'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
  'Revelation',
];

const VERSE_PATTERN = new RegExp(
  String.raw`\b(${BIBLE_BOOKS.map((book) => book.replace(/ /g, String.raw`\s+`)).join('|')})\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*\d{1,3})?`,
  'gi',
);

/** Normalizes "psalm 23:1" and "Psalms 23:1" to one comparable key. */
const normalizeVerseKey = (reference) =>
  collapse(reference).toLowerCase().replace(/^psalms\b/, 'psalm').replace(/\s+/g, ' ');

/** Every Scripture reference David actually spoke in a reply. */
export function extractVerseReferences(text) {
  const source = collapse(text);
  if (!source) return [];

  const found = [];
  for (const match of source.matchAll(VERSE_PATTERN)) {
    found.push(collapse(`${match[1]} ${match[2]}:${match[3]}`));
  }
  return unique(found);
}

/* ------------------------------------------------------------------ *
 * Opening phrases — the strongest "I've heard this before" signal
 * ------------------------------------------------------------------ */

/**
 * The first handful of words of a reply. Repetition here is what users
 * actually notice: every message starting "Mm. That's heavy." reads as a
 * script even when the rest of the reply is different.
 */
export function extractOpeningPhrase(text) {
  const source = collapse(text);
  if (!source) return '';

  // A reply often opens with a tiny listener cue ("Mm."). On its own that is
  // not a distinctive fingerprint, so pull in the next sentence until the
  // opening is long enough to actually tell two replies apart.
  const sentences = source.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let opening = '';
  for (const sentence of sentences) {
    opening = opening ? `${opening} ${sentence}` : sentence;
    if (opening.split(' ').length >= 4) break;
  }

  const words = (opening || source).split(' ').slice(0, 8).join(' ');
  return words.slice(0, 80);
}

/** Loose comparison key so "Mm, that's hard" and "Mm — that's hard." collide. */
const openingKey = (value) =>
  collapse(value).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ *
 * Topics — what keeps coming back for this person
 * ------------------------------------------------------------------ */

const TOPIC_KEYWORDS = {
  work: ['work', 'job', 'boss', 'career', 'coworker', 'shift', 'fired', 'laid off', 'interview', 'promotion', 'office'],
  money: ['money', 'rent', 'bills', 'broke', 'debt', 'afford', 'paycheck', 'finances'],
  family: ['family', 'mom', 'mother', 'dad', 'father', 'sister', 'brother', 'son', 'daughter', 'kids', 'parents', 'grandma', 'grandpa'],
  marriage: ['wife', 'husband', 'marriage', 'spouse', 'divorce', 'separated'],
  relationship: ['girlfriend', 'boyfriend', 'partner', 'breakup', 'broke up', 'dating', 'ex'],
  friendship: ['friend', 'friends', 'friendship', 'roommate'],
  health: ['sick', 'illness', 'surgery', 'doctor', 'hospital', 'diagnosis', 'pain', 'cancer', 'treatment', 'meds', 'medication'],
  grief: ['died', 'death', 'passed away', 'funeral', 'grief', 'grieving', 'lost my', 'miss him', 'miss her'],
  faith: ['god', 'prayer', 'pray', 'church', 'faith', 'bible', 'jesus', 'believe', 'sin', 'forgive'],
  sleep: ['sleep', 'insomnia', 'tired', 'exhausted', 'awake', "can't sleep"],
  school: ['school', 'class', 'exam', 'college', 'homework', 'semester', 'degree', 'studying'],
  future: ['future', 'decision', 'moving', 'move', "what's next", 'career change', 'crossroads'],
  loneliness: ['lonely', 'alone', 'isolated', 'nobody', 'by myself'],
};

const TOPIC_LABELS = {
  work: 'work',
  money: 'money and bills',
  family: 'family',
  marriage: 'their marriage',
  relationship: 'their relationship',
  friendship: 'friendships',
  health: 'health',
  grief: 'grief and loss',
  faith: 'faith and doubt',
  sleep: 'sleep and exhaustion',
  school: 'school',
  future: 'a decision they are facing',
  loneliness: 'loneliness',
};

/** Topics present in a single block of the user's own words. */
export function detectTopics(text) {
  const source = collapse(text).toLowerCase();
  if (!source) return [];

  const hits = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) hits.push(topic);
  }
  return hits;
}

/* ------------------------------------------------------------------ *
 * Concrete details — the things it would hurt to be asked twice
 * ------------------------------------------------------------------ */

const DETAIL_PATTERN =
  /\bmy\s+(wife|husband|mom|mother|dad|father|son|daughter|sister|brother|friend|boss|job|marriage|surgery|doctor|dog|cat|grandma|grandpa|church|therapist|landlord|kids?|children|baby|team|manager)\b([^.!?;]{0,70})/gi;

/**
 * Pulls short, quotable facts the user volunteered — "my wife is in the
 * hospital again", "my dad passed away last month". David carries these
 * forward so nobody has to re-explain their own life.
 */
export function extractDetails(userTexts = []) {
  const details = [];

  for (const text of userTexts) {
    const source = collapse(text);
    if (!source) continue;

    for (const match of source.matchAll(DETAIL_PATTERN)) {
      const subject = match[1].toLowerCase();
      const tail = collapse(match[2] || '')
        .replace(/^[,\-–—:]+\s*/, '')
        .replace(/\s+(and|but|so|because|which|that)$/i, '');

      const detail = tail ? `my ${subject} ${tail}` : `my ${subject}`;
      if (detail.split(' ').length >= 3) details.push(detail.slice(0, 110));
    }
  }

  // Later mentions are usually the current state of things, so keep the tail.
  return unique(details.map((detail) => detail.toLowerCase())).slice(-6);
}

/* ------------------------------------------------------------------ *
 * Time since the last conversation
 * ------------------------------------------------------------------ */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How David should *feel* the gap. Naming it keeps him from greeting someone
 * who never left, and from acting casual with someone who has been gone a month.
 */
export function describeGap(lastSeenAt, now = new Date()) {
  const last = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (!lastSeenAt || Number.isNaN(last.getTime())) return null;

  const elapsed = now.getTime() - last.getTime();
  if (elapsed < 0) return { key: 'continuing', label: 'moments ago' };
  if (elapsed < 45 * MINUTE) return { key: 'continuing', label: 'a few minutes ago' };
  if (elapsed < 6 * HOUR) return { key: 'same-day', label: 'earlier today' };
  if (elapsed < DAY) return { key: 'today', label: 'earlier today' };
  if (elapsed < 2 * DAY) return { key: 'yesterday', label: 'yesterday' };
  if (elapsed < 7 * DAY) {
    const days = Math.max(2, Math.round(elapsed / DAY));
    return { key: 'days', label: `${days} days ago` };
  }
  if (elapsed < 30 * DAY) {
    const weeks = Math.max(1, Math.round(elapsed / (7 * DAY)));
    return { key: 'weeks', label: weeks === 1 ? 'about a week ago' : `about ${weeks} weeks ago` };
  }
  return { key: 'long', label: 'over a month ago' };
}

/* ------------------------------------------------------------------ *
 * Per-turn metadata, written back to the memory table
 * ------------------------------------------------------------------ */

/**
 * Condenses one exchange into the columns the memory table already has but
 * nothing was filling in: what David opened with, what verse he spent, and a
 * one-line note of what the turn was about.
 */
export function summarizeTurn(userMessage, davidResponse) {
  const user = collapse(userMessage);
  const david = collapse(davidResponse);
  const topics = detectTopics(user);

  const summaryTopic = topics.length ? topics.map((topic) => TOPIC_LABELS[topic]).join(', ') : null;
  const snippet = user.split(' ').slice(0, 14).join(' ');

  return {
    openingPhrase: extractOpeningPhrase(david) || null,
    verseUsed: extractVerseReferences(david)[0] || null,
    shortSummary: collapse(summaryTopic ? `${summaryTopic} — "${snippet}"` : snippet).slice(0, 200) || null,
  };
}

/* ------------------------------------------------------------------ *
 * The briefing
 * ------------------------------------------------------------------ */

/**
 * Rows are newest-first, exactly as they come back from the memory table.
 *
 * @param {Array<{user_message?:string,david_response?:string,verse_used?:string,opening_phrase?:string,short_summary?:string,mood_key?:string,created_at?:string}>} rows
 * @param {{ now?: Date, firstName?: string }} options
 */
export function buildContinuityBriefing(rows = [], options = {}) {
  const history = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const now = options.now instanceof Date ? options.now : new Date();
  const firstName = collapse(options.firstName);

  if (history.length === 0) {
    return [
      'CONTINUITY — THIS IS THE FIRST TIME YOU HAVE MET THIS PERSON:',
      '- You have no history with them. Do not imply you do, and never invent a shared past.',
      '- Introduce yourself once, briefly, in your own words. Then let them lead.',
    ].join('\n');
  }

  const newest = history[0];
  const oldest = history[history.length - 1];
  const gap = describeGap(newest?.created_at, now);

  const userTexts = history.map((row) => row.user_message).filter(Boolean);
  const recentReplies = history.slice(0, 6).map((row) => row.david_response).filter(Boolean);

  // Openings: stored column first, recomputed from the reply as a fallback so
  // this still works for rows written before the column was populated.
  const recentOpenings = unique(
    history
      .slice(0, 8)
      .map((row) => collapse(row.opening_phrase) || extractOpeningPhrase(row.david_response))
      .filter(Boolean),
  ).slice(0, 8);

  const spentVerses = unique([
    ...history.map((row) => collapse(row.verse_used)).filter(Boolean),
    ...history.flatMap((row) => extractVerseReferences(row.david_response)),
  ].map(normalizeVerseKey)).slice(-14);

  const topicCounts = new Map();
  for (const text of userTexts) {
    for (const topic of detectTopics(text)) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }
  const recurringTopics = [...topicCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => TOPIC_LABELS[topic]);

  const details = extractDetails(userTexts);

  const recentSummaries = unique(
    history.slice(0, 4).map((row) => collapse(row.short_summary)).filter(Boolean),
  ).slice(0, 3);

  const moods = unique(history.slice(0, 6).map((row) => collapse(row.mood_key)).filter(Boolean))
    .slice(0, 3)
    .map((mood) => mood.toLowerCase());

  const lines = ['CONTINUITY — WHAT YOU ALREADY KNOW ABOUT THIS PERSON (never make them repeat themselves):'];

  lines.push(`- You have talked with them before: ${history.length} exchange${history.length === 1 ? '' : 's'} on record.`);
  if (firstName) lines.push(`- Their name is ${firstName}. Use it sparingly — once in a while, not every reply.`);

  if (gap) {
    if (gap.key === 'continuing') {
      lines.push('- You are still mid-conversation with them. Do NOT greet them again or restart. Pick up exactly where you left off.');
    } else {
      lines.push(`- You last spoke ${gap.label}. Acknowledge the gap naturally only if it genuinely fits — never announce it like a status report ("It has been 3 days since we spoke" is robotic).`);
      if (gap.key === 'yesterday' || gap.key === 'today' || gap.key === 'same-day') {
        lines.push('- Because it was recent, it is natural to lightly pick up a thread from last time rather than starting from zero.');
      }
      if (gap.key === 'weeks' || gap.key === 'long') {
        lines.push('- It has been a while. Be glad they came back — warmly and without guilt-tripping them for being away.');
      }
    }
  }

  if (recentSummaries.length) {
    lines.push(`- Recently you two talked about: ${recentSummaries.join(' | ')}`);
  }

  if (recurringTopics.length) {
    lines.push(`- This keeps coming back for them: ${recurringTopics.join(', ')}. When it surfaces again, name it gently and DIFFERENTLY than last time — never with the same sentence you used before.`);
  }

  if (details.length) {
    lines.push(`- Concrete things they trusted you with: ${details.join('; ')}. Carry these forward on your own. If they say something vague like "I'm scared", connect it to what you already know instead of asking them to explain from scratch.`);
  }

  if (moods.length) {
    lines.push(`- Recent emotional weather: ${moods.join(', ')}. Let that inform your tone, but do NOT assume they feel that way today — check with how they actually sound right now.`);
  }

  lines.push('');
  lines.push('ANTI-REPETITION — YOU HAVE ALREADY SAID THESE THINGS. DO NOT SAY THEM AGAIN:');

  if (recentOpenings.length) {
    lines.push(`- Openings you already used: ${recentOpenings.map((opening) => `"${opening.replace(/"/g, '')}"`).join(', ')}. Start this reply a genuinely different way — not a reworded version of these.`);
  }

  if (spentVerses.length) {
    lines.push(`- Scripture you already gave them: ${spentVerses.map(titleCase).join(', ')}. Do not reuse any of these unless they bring it up themselves. If nothing fresh genuinely fits, offer no verse at all — that is always better than recycling one.`);
  }

  if (recentReplies.length) {
    lines.push('- Do not re-offer encouragement you have already given them. If you have already told them God is near, that they are not a burden, or that it is okay to rest, find a different true thing to say rather than repeating the same reassurance.');
  }

  lines.push('- Vary your shape: if your last replies ended with a question, let this one land without one. If they were short, you have room to be a touch warmer.');
  lines.push('- Every session should feel like a new conversation with someone who remembers you — not a replay of the last one.');

  if (oldest?.created_at) {
    const since = describeGap(oldest.created_at, now);
    if (since && (since.key === 'weeks' || since.key === 'long')) {
      lines.push(`- For your own sense of the relationship: they have been talking to you since ${since.label}.`);
    }
  }

  return lines.join('\n');
}

/**
 * Rows the model should see verbatim as prior turns. Kept small on purpose —
 * the briefing above carries the long-range memory, so the transcript only
 * needs enough to keep the immediate thread coherent.
 */
export function toRecentTranscript(rows = [], limit = 8) {
  const history = (Array.isArray(rows) ? rows.filter(Boolean) : []).slice(0, limit).reverse();
  const messages = [];

  for (const row of history) {
    const user = collapse(row.user_message);
    const david = collapse(row.david_response);
    if (user) messages.push({ role: 'user', content: user });
    if (david) messages.push({ role: 'assistant', content: david });
  }

  return messages;
}

/** Exported for tests and for the greeting picker. */
export const __internals = { openingKey, normalizeVerseKey, TOPIC_LABELS };
