/** David's Cartesia voice configuration */
export const DAVID_CARTESIA_VOICE_ID = 'a5136bf9-224c-4d76-b823-52bd5efcffcc';
export const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';
export const CARTESIA_MODEL_ID = 'sonic-2';
export const CARTESIA_API_VERSION = '2025-04-16';

export function resolveCartesiaVoiceId(envVoiceId?: string | null): string {
  return envVoiceId?.trim() || DAVID_CARTESIA_VOICE_ID;
}
