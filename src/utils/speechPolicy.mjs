/**
 * The single rule that decides whether David is allowed to make a sound.
 *
 * Typed chat must never produce audio. Every path to /api/speech goes through
 * generateSpeech(), and generateSpeech() asks this module first, so a screen
 * cannot accidentally speak by forgetting a flag — an unlabelled call is
 * refused by default.
 *
 * Plain JS with no imports so it can be unit-tested with `node --test`.
 */

/** Live voice session: David is expected to talk. */
export const SPEECH_SOURCE_VOICE_MODE = 'voice-mode';
/** The user pressed a speaker button on a specific message. */
export const SPEECH_SOURCE_USER_TAP = 'user-tap';

export const ALLOWED_SPEECH_SOURCES = [SPEECH_SOURCE_VOICE_MODE, SPEECH_SOURCE_USER_TAP];

/**
 * @param {{ source?: string, voiceModeActive?: boolean }} input
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canSpeak(input) {
  // Callers may pass anything; a bad argument must refuse, never throw.
  const { source, voiceModeActive = false } =
    input && typeof input === "object" ? input : {};

  if (!source || typeof source !== "string") {
    return {
      allowed: false,
      reason: "Refused: speech was requested without a source. Typed chat must stay silent.",
    };
  }

  if (!ALLOWED_SPEECH_SOURCES.includes(source)) {
    return { allowed: false, reason: `Refused: "${source}" is not a speech source that may play audio.` };
  }

  // An explicit tap is the user asking for this exact message out loud.
  if (source === SPEECH_SOURCE_USER_TAP) {
    return { allowed: true, reason: "The user tapped the speaker button." };
  }

  // Voice mode may only speak while a voice session is actually running.
  if (!voiceModeActive) {
    return { allowed: false, reason: "Refused: voice mode is not active." };
  }

  return { allowed: true, reason: "Voice mode is active." };
}
