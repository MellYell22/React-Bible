/**
 * The instruction block David's prompt gets when detectConversationOpening()
 * (see conversationOpening.mjs) classifies a turn as a greeting, small talk,
 * or a low-signal reply rather than something substantive.
 *
 * api/chat.ts (voice) and api/david-chat.ts (text) used to each hand-write
 * their own version of this block. Same intent, different wording, two
 * places to update — exactly the kind of drift that let the free daily
 * message limit go unenforced on one of the two chat paths for a while.
 * This is the one copy both import.
 *
 * Deliberately plain string work, not a model call: this runs on every turn
 * and must be fast, free, and predictable.
 */

/** @param {'greeting'|'small-talk'|'low-signal'|null|undefined} opening */
export function buildOpeningRules(opening) {
  if (!opening) return '';

  const lines = [
    `THIS TURN IS ${opening.toUpperCase()} — HANDLE IT AS CONVERSATION, NOT AS A REQUEST FOR HELP:`,
    '- Greet them back like a friend would, in your own words. Warm, unhurried, human.',
    '- Ask at most ONE easy question when it opens a new conversation. If they are answering your question briefly, respond to that answer instead of greeting them again or asking another check-in question.',
    '- Do NOT offer Scripture, a verse, a reference, or a reflection this turn. Nobody asked for one yet, and reaching for it here is exactly what makes you feel like a form.',
    '- Do NOT assume or name a mood. They have not told you how they feel; do not guess, and do not read weight into a short message.',
    '- Do NOT answer with a bare echo like "hey." or "yeah?" on its own. Matching their size still means moving things forward — a short greeting AND a door held open.',
    '- Keep it to one or two short sentences. Light stays light.',
  ];

  if (opening === 'small-talk') {
    lines.push('- They are asking about you. Answer plainly and briefly in your own voice, without listing features and without sounding like a product description, then turn it back to them.');
  }

  if (opening === 'low-signal') {
    lines.push('- "idk" is not a crisis. Do not read depth into it or get poetic about it. Stay easy, take the pressure off, and give them an easy way in.');
  }

  lines.push(
    '- Avoid churchy stock closers. Never use "What\'s on your heart", "What brings you here today", or any phrasing you would find on a form.',
    '- Vary the way you open the door. Do not reach for "How\'s your day going?" every time — ask about what they are up to, what is new, what brought them by, or simply leave a warm opening. Different words every time.',
    '- No exclamation marks unless they are clearly celebrating something first.',
  );

  return lines.join('\n');
}
