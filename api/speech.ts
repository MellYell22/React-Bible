import { DAVID_VOICE_SETTINGS, DAVID_DEFAULT_MODEL } from '../src/utils/davidVoiceSettings.js';
const DAVID_ELEVENLABS_VOICE_ID = 'KdyHP7aXTUxKmw1tVBvn';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Default to expressive speech; retain supported latency overrides.
const FAST_ELEVENLABS_MODELS = new Set([
  'eleven_multilingual_v2',
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
]);
const DEFAULT_ELEVENLABS_MODEL = DAVID_DEFAULT_MODEL;
const requestedModel = (process.env.ELEVENLABS_MODEL || '').trim();
const ELEVENLABS_MODEL = FAST_ELEVENLABS_MODELS.has(requestedModel)
  ? requestedModel
  : DEFAULT_ELEVENLABS_MODEL;

if (requestedModel && ELEVENLABS_MODEL !== requestedModel) {
  console.warn(
    `[Speech] Ignoring ELEVENLABS_MODEL="${requestedModel}" — not a supported David voice model. Using ${DEFAULT_ELEVENLABS_MODEL}.`,
  );
}

/**
 * David's voice is a product decision, not environment config, so the code is
 * the single source of truth for it.
 *
 * It used to read `process.env.ELEVENLABS_VOICE_ID || DAVID_ELEVENLABS_VOICE_ID`,
 * which meant a stale env var in the hosting dashboard silently outranked every
 * change made here. That is exactly what happened: the constant below was
 * updated to the new voice, the deploy went green, and production kept speaking
 * in the old stock voice because the env var still pointed at it. Nothing
 * errored, so nothing surfaced.
 *
 * The env var is still read, but only to warn when it disagrees — the same
 * shape already used for ELEVENLABS_MODEL and ELEVENLABS_OUTPUT_FORMAT above.
 */
const requestedVoiceId = (process.env.ELEVENLABS_VOICE_ID || '').trim();
if (requestedVoiceId && requestedVoiceId !== DAVID_ELEVENLABS_VOICE_ID) {
  console.warn(
    `[Speech] Ignoring ELEVENLABS_VOICE_ID="${requestedVoiceId}" — David's voice is pinned in code to ${DAVID_ELEVENLABS_VOICE_ID}. Remove or update that environment variable to silence this.`,
  );
}

const FAST_OUTPUT_FORMATS = new Set([
  'mp3_22050_32',
  'mp3_44100_32',
  'mp3_44100_64',
  'mp3_44100_96',
]);
// 44.1kHz / 64kbps stays lightweight for live web playback while avoiding the
// thin, telephone-like quality of the smallest format.
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_64';
const requestedOutputFormat = (process.env.ELEVENLABS_OUTPUT_FORMAT || '').trim();
const ELEVENLABS_OUTPUT_FORMAT = FAST_OUTPUT_FORMATS.has(requestedOutputFormat)
  ? requestedOutputFormat
  : DEFAULT_OUTPUT_FORMAT;

if (requestedOutputFormat && ELEVENLABS_OUTPUT_FORMAT !== requestedOutputFormat) {
  console.warn(
    `[Speech] Ignoring ELEVENLABS_OUTPUT_FORMAT="${requestedOutputFormat}" — not a lightweight web format. Using ${DEFAULT_OUTPUT_FORMAT}.`,
  );
}

import { sanitizeForDavidSpeech } from '../src/utils/davidSpeechDelivery.js';

function previewLogText(value: string, maxLength = 180): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanTranscript(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Missing text' });
  }

  const cleanText = sanitizeForDavidSpeech(cleanTranscript(text));

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      code: 'voice_not_configured',
      error: 'David voice audio is not configured yet.',
      message: 'Add ELEVENLABS_API_KEY to the server environment to enable spoken audio.',
    });
  }

  const voiceId = DAVID_ELEVENLABS_VOICE_ID;

  try {
    const speechUrl = `${ELEVENLABS_TTS_URL}/${voiceId}?output_format=${encodeURIComponent(
      ELEVENLABS_OUTPUT_FORMAT,
    )}`;

    const requestPayload = {
      text: cleanText,
      model_id: ELEVENLABS_MODEL,
      voice_settings: DAVID_VOICE_SETTINGS,
    };

    console.log('[API Request] ElevenLabs text-to-speech', {
      url: speechUrl,
      voiceId,
      model: ELEVENLABS_MODEL,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT,
      textLength: cleanText.length,
      textPreview: previewLogText(cleanText),
      voiceSettings: requestPayload.voice_settings,
    });

    const response = await fetch(speechUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Response] ElevenLabs text-to-speech', {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responseBodyPreview: errorText.substring(0, 1000),
        request: {
          voiceId,
          model: ELEVENLABS_MODEL,
          outputFormat: ELEVENLABS_OUTPUT_FORMAT,
          text: cleanText,
        },
      });

      return res.status(response.status).json({
        error: `ElevenLabs failed (${response.status})`,
        details: errorText,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[API Response] ElevenLabs text-to-speech', {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      audioBytes: buffer.length,
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error('[Speech] ElevenLabs request failed', {
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || null,
      request: {
        voiceId,
        model: ELEVENLABS_MODEL,
        outputFormat: ELEVENLABS_OUTPUT_FORMAT,
        text: cleanText,
      },
      apiKeyPresent: !!process.env.ELEVENLABS_API_KEY,
    });

    return res.status(500).json({
      error: 'TTS failed',
      details: error?.message || String(error),
      request: {
        voiceId,
        model: ELEVENLABS_MODEL,
        outputFormat: ELEVENLABS_OUTPUT_FORMAT,
        textPreview: cleanText.substring(0, 1000),
      },
    });
  }
}
