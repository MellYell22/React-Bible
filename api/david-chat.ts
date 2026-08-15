import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const FREE_DAILY_LIMIT = 3;

const DAVID_SYSTEM_PROMPT = `You are David, a calm Christian spiritual companion inside Bible Mood Search.

Speak like a trusted friend sitting beside the user: warm, grounded, brief, human, emotionally present, and biblically thoughtful. You are not a generic assistant, preacher, therapist intake form, or support agent.

Keep each reply to one to three short natural sentences. Usually two is best. Acknowledge what the user actually said, then offer one thought or one fitting Bible verse only when it genuinely helps. Never give a sermon, list, menu of options, or multiple questions. Do not always end with a question. Vary your openings and wording. Never shame, accuse, or invent personal details. Plain spoken text only, with no markdown or bracketed stage directions.

If the user appears to be mid-thought, a short response such as “Take your time.” is enough. If the user expresses immediate danger or self-harm, respond warmly and directly and encourage immediate human or emergency support rather than giving a routine devotional response.`;

const VOICE_ADDENDUM = `\n\nVOICE MODE: This response will be spoken aloud. Keep it especially short, smooth, and natural.`;

const cleanReply = (text: string): string => {
  let value = text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[*_#`]+/g, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!value) return '';

  const sentences = value.match(/[^.!?]+[.!?]+['"’”)]*|[^.!?]+$/g) ?? [value];
  const kept: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    kept.push(sentence);
    if (/\?['"’”)]*$/.test(sentence) || kept.length >= 3) break;
  }

  value = kept.join(' ').trim();
  return value;
};

const getBearerToken = (authorization: unknown): string | null => {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getSupabaseUserClient = (accessToken: string) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SB_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase server configuration is missing.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const accessToken = getBearerToken(req.headers?.authorization);
  if (!accessToken) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Please sign in again.' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const mood = typeof req.body?.mood === 'string' ? req.body.mood.trim() : '';
  const mode = req.body?.mode === 'voice' ? 'voice' : 'chat';

  if (!message || message.length < 2 || message.length > 4000) {
    return res.status(400).json({ error: 'Invalid message', ignored: true });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[David Chat] OPENAI_API_KEY is missing in Vercel.');
    return res.status(503).json({
      code: 'AI_NOT_CONFIGURED',
      error: 'David is temporarily unavailable. Please try again shortly.',
    });
  }

  try {
    const supabase = getSupabaseUserClient(accessToken);
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Your sign-in session expired. Please sign in again.' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, role')
      .eq('id', user.id)
      .maybeSingle();

    const isOwner = profile?.role === 'owner' || profile?.subscription_tier === 'owner';
    const isPremium = isOwner
      || profile?.subscription_tier === 'plus'
      || profile?.subscription_tier === 'pro';

    if (!isPremium) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count, error: usageCountError } = await supabase
        .from('daily_feature_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('feature', 'chat')
        .gte('created_at', startOfDay.toISOString());

      if (usageCountError) {
        console.error('[David Chat] Could not read daily usage:', usageCountError.message);
      }

      if ((count ?? 0) >= FREE_DAILY_LIMIT) {
        return res.status(429).json({
          limitReached: true,
          code: 'DAILY_LIMIT_REACHED',
          feature: 'chat',
          limit: FREE_DAILY_LIMIT,
        });
      }
    }

    const { data: history, error: historyError } = await supabase
      .from('david_conversation_memory')
      .select('user_message, david_response')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (historyError) {
      console.error('[David Chat] Memory read failed:', historyError.message);
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: DAVID_SYSTEM_PROMPT + (mode === 'voice' ? VOICE_ADDENDUM : ''),
      },
    ];

    for (const row of (history ?? []).reverse()) {
      if (row?.user_message) messages.push({ role: 'user', content: row.user_message });
      if (row?.david_response) messages.push({ role: 'assistant', content: row.david_response });
    }

    const moodNote = mood ? ` (The user indicated they are feeling ${mood} today.)` : '';
    messages.push({ role: 'user', content: message + moodNote });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const configuredModel = process.env.OPENAI_MODEL?.trim();
    const model = configuredModel || 'gpt-4.1-mini';

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: mode === 'voice' ? 160 : 280,
        temperature: 0.75,
        presence_penalty: 0.5,
        frequency_penalty: 0.4,
      });
    } catch (primaryError: any) {
      const status = Number(primaryError?.status || 0);
      const code = String(primaryError?.code || primaryError?.error?.code || '');
      const shouldTryKnownModel = Boolean(configuredModel)
        && (status === 404 || code.includes('model'))
        && configuredModel !== 'gpt-4.1-mini';

      if (!shouldTryKnownModel) throw primaryError;

      console.warn(`[David Chat] Configured model ${configuredModel} failed; retrying with gpt-4.1-mini.`);
      completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages,
        max_tokens: mode === 'voice' ? 160 : 280,
        temperature: 0.75,
        presence_penalty: 0.5,
        frequency_penalty: 0.4,
      });
    }

    const rawReply = completion.choices[0]?.message?.content?.trim() || '';
    const reply = cleanReply(rawReply) || "I'm right here. What's on your heart?";

    const { error: memoryInsertError } = await supabase
      .from('david_conversation_memory')
      .insert({
        user_id: user.id,
        mood_key: mood || null,
        user_message: message,
        david_response: reply,
      });

    if (memoryInsertError) {
      console.error('[David Chat] Memory insert failed:', memoryInsertError.message);
    }

    if (!isPremium) {
      const { error: usageInsertError } = await supabase
        .from('daily_feature_usage')
        .insert({ user_id: user.id, feature: 'chat' });

      if (usageInsertError) {
        console.error('[David Chat] Usage insert failed:', usageInsertError.message);
      }
    }

    return res.status(200).json({ reply });
  } catch (error: any) {
    const status = Number(error?.status || 0);
    const providerCode = String(error?.code || error?.error?.code || '');
    console.error('[David Chat] Request failed:', {
      status: status || null,
      code: providerCode || null,
      message: error?.message || String(error),
    });

    if (status === 401 || providerCode === 'invalid_api_key') {
      return res.status(503).json({
        code: 'AI_CREDENTIAL_ERROR',
        error: 'David is temporarily unavailable. Please try again shortly.',
      });
    }

    if (status === 429) {
      return res.status(503).json({
        code: 'AI_RATE_LIMITED',
        error: 'David is busy for a moment. Please try again shortly.',
      });
    }

    return res.status(503).json({
      code: 'AI_PROVIDER_UNAVAILABLE',
      error: 'David is temporarily unavailable. Please try again shortly.',
    });
  }
}
