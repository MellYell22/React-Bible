import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export type PlanId = 'plus' | 'pro';

export interface BillingEnv {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  appUrl?: string;
  stripePriceIdPlus: string;
  stripePriceIdPro: string;
}

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getBillingEnv(): BillingEnv {
  const env: BillingEnv = {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    appUrl: process.env.APP_URL,
    stripePriceIdPlus: process.env.STRIPE_PRICE_ID_PLUS || '',
    stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO || '',
  };

  return env;
}

export function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, {
    apiVersion: '2025-01-27.acacia' as any,
  });
}

export function assertCreateCheckoutEnv(env: BillingEnv) {
  if (!env.stripeSecretKey) throw new HttpError(500, 'STRIPE_SECRET_KEY is not configured on the server');
  if (!env.supabaseUrl) throw new HttpError(500, 'SUPABASE_URL is not configured on the server');
  if (!env.supabaseAnonKey) throw new HttpError(500, 'SUPABASE_ANON_KEY is not configured on the server');
  if (!env.supabaseServiceRoleKey) throw new HttpError(500, 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
  if (!env.stripePriceIdPlus) throw new HttpError(500, 'STRIPE_PRICE_ID_PLUS is not configured on the server');
  if (!env.stripePriceIdPro) throw new HttpError(500, 'STRIPE_PRICE_ID_PRO is not configured on the server');
}

export function assertWebhookEnv(env: BillingEnv) {
  if (!env.stripeSecretKey) throw new HttpError(500, 'STRIPE_SECRET_KEY is not configured on the server');
  if (!env.stripeWebhookSecret) throw new HttpError(500, 'STRIPE_WEBHOOK_SECRET is not configured on the server');
  if (!env.supabaseUrl) throw new HttpError(500, 'SUPABASE_URL is not configured on the server');
  if (!env.supabaseServiceRoleKey) throw new HttpError(500, 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
  if (!env.stripePriceIdPlus) throw new HttpError(500, 'STRIPE_PRICE_ID_PLUS is not configured on the server');
  if (!env.stripePriceIdPro) throw new HttpError(500, 'STRIPE_PRICE_ID_PRO is not configured on the server');
}

export function mapPlanToPriceId(planId: string, env: BillingEnv): string {
  if (planId === 'plus') return env.stripePriceIdPlus;
  if (planId === 'pro') return env.stripePriceIdPro;
  throw new HttpError(400, `Invalid planId "${planId}". Expected "plus" or "pro".`);
}

export function getPlanFromPriceId(priceId: string | null | undefined, env: BillingEnv): 'plus' | 'pro' | 'free' {
  if (!priceId) return 'free';
  if (priceId === env.stripePriceIdPlus) return 'plus';
  if (priceId === env.stripePriceIdPro) return 'pro';
  return 'free';
}

export function getAppUrl(req: { headers?: Record<string, string | string[] | undefined> }, fallback?: string): string {
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : null;
  const host = typeof req.headers?.host === 'string' ? req.headers.host : null;
  const forwardedProto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'https';

  if (origin) return origin;
  if (fallback) return fallback;
  if (host) return `${forwardedProto}://${host}`;
  return 'http://localhost:3000';
}

export async function resolveUserFromAuthHeader(authHeader: string | undefined, env: BillingEnv) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header');
  }

  const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, 'Unable to authenticate user for checkout');
  }

  return user;
}

export function createSupabaseAdmin(env: BillingEnv) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function ensureStripeCustomer(params: {
  stripe: Stripe;
  adminClient: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
  email?: string | null;
}) {
  const { stripe, adminClient, userId, email } = params;

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new HttpError(500, `Failed to fetch profile for checkout: ${profileError.message}`);
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  await adminClient
    .from('profiles')
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return customer.id;
}
