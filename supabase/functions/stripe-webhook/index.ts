import Stripe from "npm:stripe@12.15.0";
import { createClient } from "npm:@supabase/supabase-js@2.26.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const PRO_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID_PRO") || "price_1TRTQuGDw0P2L0A1MsgZiMeM";
const OWNER_EMAIL = "alissasmith.apps@gmail.com";
const PAID_STATUSES = new Set(["active", "trialing"]);

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

const SUPABASE_WRITE_KEY = resolveSecretKey();
if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_WRITE_KEY) throw new Error("Missing Supabase write key");
if (!PRO_PRICE_ID.startsWith("price_")) throw new Error("Missing STRIPE_PRICE_ID_PRO");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
const supabase = createClient(SUPABASE_URL, SUPABASE_WRITE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const jsonHeaders = { "Content-Type": "application/json" };
const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: jsonHeaders },
);

const getId = (value: string | { id: string } | null | undefined) => (
  typeof value === "string" ? value : value?.id || null
);

type ProfileRecord = {
  id: string;
  email: string | null;
  subscription_tier: string | null;
};

const findProfile = async ({
  userId,
  customerId,
  email,
}: {
  userId?: string | null;
  customerId?: string | null;
  email?: string | null;
}): Promise<ProfileRecord | null> => {
  if (userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, subscription_tier")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ProfileRecord;
  }

  if (customerId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, subscription_tier")
      .eq("stripe_customer_id", customerId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ProfileRecord;
  }

  if (email) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, subscription_tier")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ProfileRecord;
  }

  return null;
};

const getCustomerEmail = async (customerId: string | null): Promise<string | null> => {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as any).deleted) return null;
    return (customer as Stripe.Customer).email || null;
  } catch (error) {
    console.warn("[stripe-webhook] Unable to retrieve Stripe customer email:", error);
    return null;
  }
};

const ignore = (reason: string) => {
  console.warn(`[stripe-webhook] Ignored: ${reason}`);
  return json({ received: true, ignored: true, reason });
};

const processSubscription = async (
  subscription: Stripe.Subscription,
  fallbackEmail: string | null = null,
) => {
  const priceIds = subscription.items.data.map((item) => item.price.id);
  if (!priceIds.includes(PRO_PRICE_ID)) {
    return ignore(`subscription ${subscription.id} belongs to another app or price`);
  }

  const customerId = getId(subscription.customer);
  const userId = subscription.metadata?.userId || subscription.metadata?.user_id || null;
  const email = fallbackEmail || await getCustomerEmail(customerId);
  const profile = await findProfile({ userId, customerId, email });

  if (!profile) {
    return ignore(`no Bible Mood Search profile matches subscription ${subscription.id}`);
  }

  const isOwner = profile.subscription_tier === "owner"
    || profile.email?.toLowerCase() === OWNER_EMAIL;
  const isPaid = PAID_STATUSES.has(subscription.status);
  const update: Record<string, unknown> = {
    subscription_status: isPaid || isOwner ? "active" : subscription.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    stripe_price_id: PRO_PRICE_ID,
  };

  if (typeof subscription.current_period_end === "number") {
    update.stripe_current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }
  if (!isOwner) update.subscription_tier = isPaid ? "pro" : "free";

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", profile.id)
    .select("id, subscription_tier")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Profile ${profile.id} disappeared during subscription update.`);

  console.log(`[stripe-webhook] ${profile.id} -> ${data.subscription_tier}`);
  return json({ received: true, processed: true, profileId: profile.id, tier: data.subscription_tier });
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return json({ error: "Missing Stripe-Signature header" }, 400);

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(await req.text(), signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("[stripe-webhook] Signature verification failed:", error);
      return json({ error: "Webhook signature verification failed" }, 400);
    }

    const keyIsLive = STRIPE_SECRET_KEY.startsWith("sk_live_");
    if (event.livemode !== keyIsLive) {
      console.error("[stripe-webhook] Stripe mode mismatch.");
      return json({ error: "Stripe mode mismatch" }, 400);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = getId(checkout.subscription);
        if (checkout.mode !== "subscription" || !subscriptionId) {
          return ignore(`checkout ${checkout.id} is not a subscription checkout`);
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = checkout.client_reference_id || checkout.metadata?.userId || checkout.metadata?.user_id;
        if (userId && !subscription.metadata?.userId && !subscription.metadata?.user_id) {
          subscription.metadata = { ...subscription.metadata, userId, user_id: userId };
        }

        return processSubscription(
          subscription,
          checkout.customer_details?.email || checkout.customer_email || null,
        );
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return processSubscription(event.data.object as Stripe.Subscription);

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getId((invoice as any).subscription);
        if (!subscriptionId) return ignore(`invoice ${invoice.id} has no subscription`);
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        return processSubscription(subscription, invoice.customer_email || null);
      }

      case "invoice.payment_failed":
        console.warn("[stripe-webhook] Payment failed; waiting for subscription status update.");
        return json({ received: true, processed: true });

      default:
        return ignore(`unsupported event ${event.type}`);
    }
  } catch (error) {
    console.error("[stripe-webhook] Processing failed:", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
