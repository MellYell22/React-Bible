const DAVID_CARTESIA_VOICE_ID = 'a5136bf9-224c-4d76-b823-52bd5efcffcc';
const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_MODEL_ID = 'sonic-2';
const CARTESIA_API_VERSION = '2025-04-16';

function resolveCartesiaVoiceId(envVoiceId?: string | null): string {
  return envVoiceId?.trim() || DAVID_CARTESIA_VOICE_ID;
}

/** Strip any markup so Cartesia receives plain conversational text. */
function cleanTranscript(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Call Cartesia TTS and return the audio byte response. */
async function callCartesia(
  apiKey: string,
  voiceId: string,
  text: string,
): Promise<Response> {
  return fetch(CARTESIA_TTS_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': process.env.CARTESIA_API_VERSION || CARTESIA_API_VERSION,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: process.env.CARTESIA_MODEL_ID || CARTESIA_MODEL_ID,
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId,
      },
      language: 'en',
      output_format: {
        container: 'mp3',
        bit_rate: 128000,
        sample_rate: 44100,
      },
    }),
  });
}

export default async function handler(req: any, res: any) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate input ────────────────────────────────────────────────────────
  const rawText = req.body?.text;
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    console.warn('[Speech API] Missing or empty text parameter');
    return res.status(400).json({ error: 'Missing text parameter' });
  }

  const text = cleanTranscript(rawText);
  if (!text) {
    return res.status(400).json({ error: 'Text was empty after stripping markup' });
  }

  // ── API Key ───────────────────────────────────────────────────────────────
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    console.error('[Speech API] CRITICAL: CARTESIA_API_KEY not set in environment');
    return res.status(500).json({
      error: 'Cartesia API key not configured. Add CARTESIA_API_KEY to Vercel env vars.',
    });
  }
  const voiceId = resolveCartesiaVoiceId(process.env.CARTESIA_VOICE_ID);
  console.log(`[Speech API] Cartesia key OK (len=${apiKey.length}), voice=${voiceId}, text="${text.substring(0, 60)}..."`);

  try {
    const response = await callCartesia(apiKey, voiceId, text);
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Speech API] Cartesia failed: HTTP ${response.status} — ${body.substring(0, 500)}`);
      return res.status(response.status).json({
        error: `Cartesia TTS failed (${response.status})`,
        details: body,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error('[Speech API] Cartesia request threw:', error?.message || error);
    return res.status(500).json({
      error: 'Cartesia TTS request failed',
      details: error?.message || String(error),
    });
  }
}
