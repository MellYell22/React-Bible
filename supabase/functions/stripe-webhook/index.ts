import Stripe from "npm:stripe@12.15.0";
import { createClient } from "npm:@supabase/supabase-js@2.26.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

// The project's legacy anon/service_role keys are disabled. Profile writes
// require a modern secret key (sb_secret_...) stored as a function secret.
const resolveSecretKey = (): string | null => {
  const candidates = [
    Deno.env.get("SB_SECRET_KEY"),
    Deno.env.get("SUPABASE_SECRET_KEY"),
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.startsWith("sb_secret_")) return candidate;
  }
  // Legacy fallback: works only if legacy keys are re-enabled in the dashboard.
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;
};

const SUPABASE_WRITE_KEY = resolveSecretKey();

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_WRITE_KEY) throw new Error("Missing SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_WRITE_KEY.startsWith("sb_secret_")) {
  console.warn("[stripe-webhook] Using legacy service_role key. If legacy keys are disabled, profile updates will fail — add an SB_SECRET_KEY function secret.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

// Webhook endpoint intentionally does NOT require Authorization/JWT.
// Requests are authenticated by verifying the Stripe signature below.
const supabase = createClient(SUPABASE_URL, SUPABASE_WRITE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Stripe-Signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // NOTE: Stripe typically won't send OPTIONS, but some environments/proxies do.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing Stripe-Signature header" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const rawBody = new Uint8Array(await req.arrayBuffer());

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[stripe-webhook] signature verification failed:", message);
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log("Webhook event type:", event.type);

    // Helper to update profile subscription fields.
    // The app reads profiles.subscription_tier — there is no "tier" column.
    const updateProfileSubscription = async (userId: string, args: {
      tier: "pro" | "free";
      customer: string | null;
      subscription: string | null;
      subscriptionStatus?: string | null;
      priceId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: args.tier,
          subscription_status: args.subscriptionStatus || (args.tier === "pro" ? "active" : "canceled"),
          stripe_customer_id: args.customer,
          stripe_subscription_id: args.subscription,
          stripe_subscription_status: args.subscriptionStatus || "active",
          stripe_price_id: args.priceId,
        })
        .eq("id", userId)
        .select("id");

      console.log("Update result:", data, error);

      if (error) throw error;

      const rowCount = data?.length ?? 0;
      if (rowCount === 0) {
        console.error("No rows updated. User not found:", userId);
      }
    };

    // Process supported events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId =
          session.client_reference_id ||
          (session.metadata as any)?.userId;

        console.log("Extracted userId:", userId);

        if (!userId) {
          console.error("No userId found in Stripe session");
          return new Response(JSON.stringify({ error: "No userId found in Stripe session" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        await updateProfileSubscription(userId, {
          tier: "pro",
          customer: typeof session.customer === "string" ? session.customer : session.customer?.toString() || null,
          subscription: (session.subscription as string) || null,
          subscriptionStatus: "active",
          priceId: (session as any)?.display_items?.[0]?.price?.id || null,
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = (subscription.metadata as any)?.userId || (subscription as any)?.client_reference_id;
        console.log("Extracted userId:", userId);

        if (!userId) {
          console.error("No userId found in Stripe subscription");
          return new Response(JSON.stringify({ error: "No userId found in Stripe subscription" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        await updateProfileSubscription(userId, {
          tier: isActive ? "pro" : "free",
          customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.toString() || null,
          subscription: subscription.id,
          subscriptionStatus: subscription.status || "active",
          priceId,
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = (subscription.metadata as any)?.userId;
        console.log("Extracted userId:", userId);

        if (!userId) {
          console.error("No userId found in Stripe subscription");
          return new Response(JSON.stringify({ error: "No userId found in Stripe subscription" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        await updateProfileSubscription(userId, {
          tier: "free",
          customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.toString() || null,
          subscription: subscription.id,
          subscriptionStatus: "canceled",
          priceId: subscription.items?.data?.[0]?.price?.id || null,
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        const userId = (invoice.metadata as any)?.userId || (invoice as any)?.client_reference_id;
        console.log("Extracted userId:", userId);

        if (!userId) {
          // Renewal invoices often lack user metadata; the subscription events
          // above keep the profile in sync, so acknowledge without failing.
          console.log("No userId on invoice; relying on subscription events.");
          return new Response(JSON.stringify({ received: true, ignored: true }), {
            status: 200,
            headers: corsHeaders,
          });
        }

        const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.toString() || null;
        const subscriptionId = (invoice.subscription as string) || null;
        const priceId = (invoice.lines?.data?.[0] as any)?.price?.id || null;

        await updateProfileSubscription(userId, {
          tier: "pro",
          customer,
          subscription: subscriptionId,
          subscriptionStatus: "active",
          priceId,
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      default:
        // Unhandled event types should still return 200 to Stripe.
        return new Response(JSON.stringify({ received: true, ignored: true }), {
          status: 200,
          headers: corsHeaders,
        });
    }
  } catch (error) {
    console.error("[stripe-webhook] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
