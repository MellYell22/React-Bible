import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  claimReflectionUsage,
  getBearerToken,
  refundReflectionUsage,
  ReflectionUsageClaim,
} from '../lib/reflectionUsage.js';

const DAVID_PERSONALITY_PROMPT = `You are David, a calm Christian spiritual companion inside Bible Mood Search.

You sound warm, grounded, brief, and biblically thoughtful. Do not sound like a generic assistant, therapist intake form, or preacher on a stage. Keep reflections natural, compassionate, and easy to understand.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const verse = typeof req.body?.verse === 'string' ? req.body.verse.trim() : '';
  const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
  if (!verse || !reference || verse.length > 2000 || reference.length > 200) {
    return res.status(400).json({ error: 'A valid verse and reference are required.' });
  }

  const accessToken = getBearerToken(req.headers?.authorization);
  if (!accessToken) {
    return res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Please sign in to use your three free reflections each day.',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Reflection service is temporarily unavailable.' });
  }

  const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase reflection-limit credentials are not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  };

  let userId: string | null = null;
  let claim: ReflectionUsageClaim | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return res.status(401).json({
        code: 'AUTH_REQUIRED',
        error: 'Your sign-in session expired. Please sign in again.',
      });
    }

    userId = user.id;
    claim = await claimReflectionUsage(supabase, user.id);
    if (!claim.allowed) {
      return res.status(429).json({
        code: 'DAILY_REFLECTION_LIMIT_REACHED',
        limitReached: true,
        dailyLimit: claim.dailyLimit,
        used: claim.used,
        remaining: 0,
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: DAVID_PERSONALITY_PROMPT },
        {
          role: 'user',
          content: `Provide a short, compassionate, and spiritually grounded reflection on the following Bible verse: "${verse}" (${reference}).
Briefly explain how it applies to a person's life today. The reflection must be exactly 3-4 sentences long.`
        }
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty reflection.');

    return res.status(200).json({
      text,
      usage: {
        dailyLimit: claim.dailyLimit,
        used: claim.used,
        remaining: claim.remaining,
        unlimited: claim.unlimited,
      },
    });
  } catch (error: any) {
    console.error('[OpenAI] Reflection error:', error?.message || error);

    if (userId && claim?.claimId) {
      try {
        await refundReflectionUsage(getSupabaseAdmin(), userId, claim.claimId);
      } catch (refundError: any) {
        console.error('[Reflection Limit] Refund failed:', refundError?.message || refundError);
      }
    }

    return res.status(500).json({ error: 'David could not create a reflection right now. Please try again.' });
  }
}
