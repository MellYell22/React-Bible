import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PRO_PRICE_ID, stripeModeFromSecretKey } from '../lib/subscriptionState.js';
import { processStripeEvent } from '../lib/stripeWebhook.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const getRawBody = (req: any) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return {
    stripe: new Stripe(secretKey, { apiVersion: '2023-10-16' as any }),
    secretKey,
  };
};

const getSupabase = () => {
  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const writeKey = process.env.SB_SECRET_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !writeKey) {
    throw new Error('Supabase webhook write credentials are not configured.');
  }

  return createClient(supabaseUrl, writeKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');

    const { stripe, secretKey } = getStripe();
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' });

    const event = stripe.webhooks.constructEvent(await getRawBody(req), signature, webhookSecret);
    const configuredMode = stripeModeFromSecretKey(secretKey);
    const eventMode = event.livemode ? 'live' : 'test';

    if (configuredMode !== 'unknown' && configuredMode !== eventMode) {
      console.error(`[Stripe Webhook] Mode mismatch: ${configuredMode} key received a ${eventMode} event.`);
      return res.status(400).json({ error: 'Stripe mode mismatch' });
    }

    const proPriceId = process.env.STRIPE_PRICE_ID_PRO || DEFAULT_PRO_PRICE_ID;
    const result = await processStripeEvent({
      event,
      stripe,
      supabase: getSupabase(),
      proPriceId,
    });

    return res.status(200).json({ received: true, ...result });
  } catch (error: any) {
    console.error('[Stripe Webhook] Processing failed:', error?.message || error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
