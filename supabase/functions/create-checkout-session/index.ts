import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PRO_PRICE_ID = "price_1TRTQuGDw0P2L0A1MsgZiMeM";
const TRIAL_PERIOD_DAYS = 7;

// The project's legacy anon/service_role keys are disabled, so auth calls must
// use a modern publishable key. Publishable keys are safe to embed.
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_XpVDXroi6heBFrljTrWGrA__tFu6PTp";

const resolveAuthApiKey = (): string => {
  const candidates = [
    Deno.env.get("SB_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.startsWith("sb_publishable_")) return candidate;
  }
  return FALLBACK_PUBLISHABLE_KEY;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Only use the env var if it looks like a real Stripe price ID
    const envPriceId = Deno.env.get("STRIPE_PRICE_ID_PRO");
    const proPriceId = (envPriceId && envPriceId.startsWith("price_")) ? envPriceId : DEFAULT_PRO_PRICE_ID;
    console.log(`[create-checkout-session] Using price ID: ${proPriceId}`);

    let userId: string | undefined = undefined;
    let userEmail: string | undefined = undefined;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[create-checkout-session] Error: Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, resolveAuthApiKey(), {
      global: { headers: { Authorization: authHeader } },
    });

    // IMPORTANT: pass the JWT explicitly. In a server context there is no
    // stored session, so getUser() without an argument always fails with
    // "Auth session missing" regardless of the token's validity.
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error(`[create-checkout-session] Auth error or user not found: ${userError?.message}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    userId = user.id;
    userEmail = user.email;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();

    const existingCustomerId = profile?.stripe_customer_id;
    console.log(`[create-checkout-session] Authenticated user: ${userId}, Existing Stripe ID: ${existingCustomerId || 'none'}`);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("[create-checkout-session] CRITICAL: STRIPE_SECRET_KEY is not set in Supabase secrets.");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Stripe key missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTestMode = stripeSecretKey.startsWith("sk_test_");
    console.log(`[create-checkout-session] Stripe Mode: ${isTestMode ? "TEST" : "LIVE"}`);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "http://localhost:3000";
    const normalizedOrigin = origin.replace(/\/$/, "");
    console.log(`[create-checkout-session] Creating Pro checkout for user: ${userId}, price: ${proPriceId}, origin: ${normalizedOrigin}`);

    // Only offer the free trial to customers who have never had a subscription.
    const hadSubscriptionBefore = !!profile?.stripe_subscription_id;

    try {
      const sessionOptions: any = {
        payment_method_types: ["card"],
        line_items: [
          {
            price: proPriceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        subscription_data: {
          ...(hadSubscriptionBefore ? {} : { trial_period_days: TRIAL_PERIOD_DAYS }),
          metadata: {
            userId,
            user_id: userId,
          },
        },
        success_url: `${normalizedOrigin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${normalizedOrigin}/?canceled=true&showPricing=true`,
        client_reference_id: userId,
        metadata: {
          userId,
          user_id: userId,
        },
      };

      if (existingCustomerId) {
        sessionOptions.customer = existingCustomerId;
      } else if (userEmail) {
        sessionOptions.customer_email = userEmail;
      }

      const session = await stripe.checkout.sessions.create(sessionOptions);

      console.log(`[create-checkout-session] Session created successfully: ${session.id}, URL: ${session.url}`);
      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (stripeError: any) {
      console.error(`[create-checkout-session] Stripe API Error: ${stripeError.message}`);
      return new Response(
        JSON.stringify({ error: `Stripe Error: ${stripeError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error(`[create-checkout-session] Unexpected Error: ${error.message}`);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please check server logs." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
