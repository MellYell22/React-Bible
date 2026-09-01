/**
 * Sentence streaming for David's voice.
 *
 * David used to wait for his entire reply to finish generating, then send the
 * whole thing to text-to-speech, then start talking. Three serial waits stacked
 * end to end before the user heard a single word.
 *
 * This splitter lets him start speaking his first sentence while the rest is
 * still being written. Text arrives in fragments; this hands back complete
 * spoken units the moment they are safe to say out loud.
 *
 * "Safe to say" is the whole problem. Cut too eagerly and David says "There's a
 * line in Philippians 4" and stops dead. Cut too late and there was no point
 * streaming at all.
 */

/**
 * Abbreviations whose trailing period never ends a sentence. Without these,
 * "Dr. Luke wrote it" becomes two utterances with a hard stop after "Dr."
 */
const ABBREVIATIONS = [
  'mr', 'mrs', 'ms', 'dr', 'st', 'sr', 'jr', 'prof', 'rev', 'fr',
  'vs', 'etc', 'eg', 'ie', 'approx', 'apt', 'no',
];

/**
 * A short opener like "Yeah." or "Mm." is a real thing David says, but on its
 * own it makes a two-word audio clip followed by an awkward gap while the next
 * clip renders. Openers get merged into the sentence that follows them.
 */
// Every listener cue David is allowed to use is 8 characters or fewer ("Mm.",
// "Yeah.", "Right.", "I see.", "Okay."), while his shortest genuine sentences
// ("What happened?", "Tell me more.") run 12 or more. 12 is the clean line
// between "merge this fragment" and "this is worth its own clip."
const MIN_CHUNK_CHARS = 12;

/** Never let one utterance grow unbounded if the model forgets to punctuate. */
const MAX_CHUNK_CHARS = 240;

const ENDS_SENTENCE = /[.!?…]/;

/**
 * True when the period at `index` is a real full stop rather than part of an
 * abbreviation, a decimal, an ellipsis, or a verse reference like "4:6".
 */
function isSentenceEnd(text, index) {
  const char = text[index];
  if (!ENDS_SENTENCE.test(char)) return false;

  // "!" and "?" are unambiguous.
  if (char === '!' || char === '?') return true;

  // An ellipsis ends a thought only at its final dot.
  if (char === '.' && text[index + 1] === '.') return false;

  // A decimal or a chapter:verse number is mid-token: "3.5", "Psalm 23.1".
  if (/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || '')) return false;

  // Abbreviation check: read the word immediately before the dot.
  const before = text.slice(0, index);
  const lastWord = (before.match(/([A-Za-z]+)$/) || [])[1];
  if (lastWord && ABBREVIATIONS.includes(lastWord.toLowerCase())) return false;

  // A lone capital before the dot is an initial — "C. S. Lewis".
  if (lastWord && lastWord.length === 1 && lastWord === lastWord.toUpperCase()) return false;

  return true;
}

/**
 * Finds the end of the first complete sentence in `text`, or -1.
 * Returns the index just past the sentence's closing punctuation and any
 * quotes or brackets that belong to it.
 */
function findSentenceEnd(text) {
  for (let i = 0; i < text.length; i += 1) {
    if (!isSentenceEnd(text, i)) continue;

    let end = i + 1;
    // Absorb repeated terminators ("!!", "?!") and trailing quotes.
    while (end < text.length && /[.!?…'"’”)\]]/.test(text[end])) end += 1;

    // Only treat it as complete once whitespace (or nothing) follows. Mid-token
    // punctuation inside an unfinished word is not a boundary.
    if (end >= text.length || /\s/.test(text[end])) return end;
  }
  return -1;
}

/**
 * Creates a splitter over a growing body of text.
 *
 * Usage: call `push(fullTextSoFar)` on every stream update — it takes the whole
 * accumulated string, not a delta, because that is what the SSE loop already
 * has. It returns any sentences that became complete since the last call.
 * Call `flush()` once the stream ends to collect the remainder.
 */
export function createSentenceStream(options = {}) {
  const minChars = options.minChars ?? MIN_CHUNK_CHARS;
  const maxChars = options.maxChars ?? MAX_CHUNK_CHARS;

  let consumed = 0;
  let carry = '';

  const takeReady = (available, isFinal) => {
    const ready = [];
    let working = carry + available;

    for (;;) {
      const end = findSentenceEnd(working);

      if (end === -1) {
        // No boundary. If the model has rambled past the cap, cut at the last
        // space so a clause still sounds natural rather than clipping a word.
        if (!isFinal && working.length > maxChars) {
          const cut = working.lastIndexOf(' ', maxChars);
          if (cut > minChars) {
            ready.push(working.slice(0, cut).trim());
            working = working.slice(cut);
            continue;
          }
        }
        break;
      }

      const candidate = working.slice(0, end).trim();
      const rest = working.slice(end);

      // Too short to be worth its own audio clip — hold it and let it ride
      // along with whatever comes next.
      if (candidate.length < minChars && !(isFinal && !rest.trim())) {
        const nextEnd = findSentenceEnd(rest);
        if (nextEnd === -1 && !isFinal) break;
        if (nextEnd !== -1) {
          ready.push((candidate + rest.slice(0, nextEnd)).trim());
          working = rest.slice(nextEnd);
          continue;
        }
      }

      if (candidate) ready.push(candidate);
      working = rest;
    }

    carry = working;
    return ready;
  };

  return {
    /** Feed the full accumulated text; get back newly completed sentences. */
    push(fullText) {
      const text = typeof fullText === 'string' ? fullText : '';
      if (text.length < consumed) {
        // The stream restarted — start clean rather than emitting garbage.
        consumed = 0;
        carry = '';
      }
      const available = text.slice(consumed);
      consumed = text.length;
      return takeReady(available, false);
    },

    /** Call once at end of stream to emit whatever is left. */
    flush() {
      const remaining = takeReady('', true);
      const tail = carry.trim();
      carry = '';
      if (tail) remaining.push(tail);
      return remaining;
    },
  };
}

/** One-shot split, used by tests and any non-streaming caller. */
export function splitIntoSentences(text, options = {}) {
  const stream = createSentenceStream(options);
  const out = stream.push(typeof text === 'string' ? text : '');
  return [...out, ...stream.flush()];
}
