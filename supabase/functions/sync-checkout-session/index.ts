import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_EMAIL = "alissasmith.apps@gmail.com";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_XpVDXroi6heBFrljTrWGrA__tFu6PTp";
const PAID_STATUSES = new Set(["active", "trialing"]);

type PaidTier = "plus" | "pro";
const isValidPrice = (v: string | null | undefined): v is string => typeof v === "string" && v.startsWith("price_");

const getConfiguredTierPrices = (): { plus: string | null; pro: string | null } => ({
  plus: (() => { const v = Deno.env.get("STRIPE_PRICE_ID_PLUS")?.trim(); return isValidPrice(v) ? v : null; })(),
  pro: (() => { const v = Deno.env.get("STRIPE_PRICE_ID_PRO")?.trim(); return isValidPrice(v) ? v : null; })(),
});

const matchTier = (priceIds: string[], prices: { plus: string | null; pro: string | null }): PaidTier | null => {
  if (prices.pro && priceIds.includes(prices.pro)) return "pro";
  if (prices.plus && priceIds.includes(prices.plus)) return "plus";
  return null;
};

const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const resolveAuthApiKey = (): string => {
  for (const candidate of [
    Deno.env.get("SB_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
  ]) {
    if (candidate?.startsWith("sb_publishable_")) return candidate;
  }
  return FALLBACK_PUBLISHABLE_KEY;
};

const resolveSecretKey = (): string | null => {
  for (const candidate of [
    Deno.env.get("SB_SECRET_KEY"),
    Deno.env.get("SUPABASE_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ]) {
    if (candidate) return candidate;
  }
  return null;
};

const getId = (value: string | { id: string } | null | undefined) => (
  typeof value === "string" ? value : value?.id || null
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const tierPrices = getConfiguredTierPrices();

    if (!authHeader || !supabaseUrl || !stripeSecretKey || (!tierPrices.plus && !tierPrices.pro)) {
      return json({ error: "Unable to verify checkout because billing is not fully configured." }, 500);
    }

    const { sessionId } = await req.json();
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return json({ error: "Invalid Stripe Checkout Session ID." }, 400);
    }

    const authClient = createClient(supabaseUrl, resolveAuthApiKey(), {
      global: { headers: { Authorization: authHeader } },
    });
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "Your sign-in session expired. Please sign in again." }, 401);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const checkoutUserId = checkout.client_reference_id || checkout.metadata?.userId || checkout.metadata?.user_id;

    if (checkout.mode !== "subscription" || checkoutUserId !== user.id) {
      return json({ error: "This checkout does not belong to this signed-in account." }, 403);
    }

    if (!checkout.subscription || !["paid", "no_payment_required"].includes(checkout.payment_status)) {
      return json({ error: "Stripe has not confirmed this subscription yet. Please try again shortly." }, 409);
    }

    const keyIsLive = stripeSecretKey.startsWith("sk_live_");
    if (checkout.livemode !== keyIsLive) {
      console.error(`[sync-checkout-session] Stripe mode mismatch for ${sessionId}.`);
      return json({ error: "This checkout was created in a different Stripe mode." }, 409);
    }

    const subscriptionId = getId(checkout.subscription);
    if (!subscriptionId) return json({ error: "Stripe did not return a subscription ID." }, 409);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceIds = subscription.items.data.map((item) => item.price.id);
    const matchedTier = matchTier(priceIds, tierPrices);
    if (!PAID_STATUSES.has(subscription.status) || !matchedTier) {
      return json({ error: "This checkout did not create an active Bible Mood Search subscription." }, 409);
    }

    const writeKey = resolveSecretKey();
    const writeClient = writeKey ? createClient(supabaseUrl, writeKey) : authClient;
    const { data: existingProfile, error: readError } = await writeClient
      .from("profiles")
      .select("id, email, role, subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) throw readError;
    if (!existingProfile) return json({ error: "We could not find a profile for this account." }, 404);

    // Owner lives in profiles.role — subscription_tier is constrained to
    // free | plus | pro by the database, so it can never hold "owner".
    const preserveOwner = user.email?.toLowerCase() === OWNER_EMAIL
      || existingProfile.role === "owner"
      || existingProfile.subscription_tier === "owner";
    const update: Record<string, unknown> = {
      subscription_status: "active",
      stripe_customer_id: getId(checkout.customer),
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_price_id: priceIds[0] || null,
      stripe_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    };
    if (!preserveOwner) update.subscription_tier = matchedTier;

    const { data: profile, error: updateError } = await writeClient
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select("id, subscription_tier")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!profile) return json({ error: "Stripe confirmed payment, but the profile update did not complete." }, 500);

    console.log(`[sync-checkout-session] Activated ${profile.subscription_tier} for ${user.id}.`);
    return json({ subscriptionTier: profile.subscription_tier });
  } catch (error: any) {
    console.error("[sync-checkout-session] Failed:", error?.message || error);
    return json({ error: "Unable to verify checkout right now. Please try again shortly." }, 500);
  }
});
