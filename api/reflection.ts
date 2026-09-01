import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { DAVID_NO_FABRICATION_RULE } from '../src/constants/persona.js';
import {
  claimReflectionUsage,
  getBearerToken,
  refundReflectionUsage,
  ReflectionUsageClaim,
} from '../lib/reflectionUsage.js';

const DAVID_PERSONALITY_PROMPT = `You are David, a calm Christian spiritual companion inside Bible Mood Search.

You sound warm, grounded, brief, and biblically thoughtful. Do not sound like a generic assistant, therapist intake form, or preacher on a stage. Keep reflections natural, compassionate, and easy to understand.
${DAVID_NO_FABRICATION_RULE}
CRITICAL FOR THIS SCREEN: you have been given a verse and NOTHING ELSE. You do not know who is reading it or what is happening in their life. You have no idea whether they are a student, employed, married, single, a parent, sick, well, young or old.
- Never write as though you know their circumstances. No "when work feels overwhelming," no "as you study for exams," no "in your marriage," no "after a long day at the office," no "as a parent."
- Never invent a scenario, a backstory, or a feeling they are supposedly having right now.
- Speak about what the verse itself says and what it means, in plain words that stay true for anyone reading.
- Use "you" only in the open, non-presuming way Scripture itself does — never to assert a fact about their life.`;

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
          content: `Reflect on this verse: "${verse}" (${reference}).

Write it in this shape, as flowing prose with no headings, labels, numbers, or bullets:
1. One sentence naming what this verse is actually saying — the verse itself, not a situation you imagine the reader is in.
2. One brief biblical parallel: a single person or moment in Scripture that genuinely lived this truth. Exactly one, named plainly.
3. One or two plain sentences explaining what it means, in everyday language a person could repeat to a friend.
4. End with ONE open-ended question that invites the reader to bring their own life to it — a question that works no matter who they are, and that assumes nothing about their job, school, family, health, or circumstances.

Four to five short sentences total. Do not assume anything about the reader's life. Do not describe a scenario they might be in. Do not quote any verse other than the one given.`
        }
      ],
      // Lower temperature: fabricated detail scales with temperature.
      temperature: 0.5,
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
