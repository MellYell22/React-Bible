import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

let stripeInstance: Stripe | null = null;

const getStripe = () => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeInstance = new Stripe(key, {
        apiVersion: '2025-01-27.acacia' as any,
      });
    }
  }
  return stripeInstance;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  console.log(`[StripeWebhook] >>> START: Received webhook event.`);

  if (!stripe) {
    console.error("[StripeWebhook] ERROR: Stripe is not configured.");
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }

  if (!sig || !webhookSecret) {
    console.error("[StripeWebhook] ERROR: Stripe webhook configuration missing (signature or secret).");
    return res.status(400).json({ error: "Webhook Error: Configuration missing" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log(`[StripeWebhook] Event Type: ${event.type}`);
  } catch (err: any) {
    console.error(`[StripeWebhook] ERROR: Verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        let priceId = session.metadata?.priceId;

        console.log(`[StripeWebhook] Checkout completed. User: ${userId}, Price (from metadata): ${priceId}`);

        // If priceId not in metadata, try to get it from line items
        if (!priceId) {
          try {
            const lineItems = await stripe?.checkout.sessions.listLineItems(session.id);
            priceId = lineItems?.data?.[0]?.price?.id;
            console.log(`[StripeWebhook] Price from line items: ${priceId}`);
          } catch (err) {
            console.error(`[StripeWebhook] Failed to fetch line items: ${err}`);
          }
        }

        if (userId && supabase && priceId) {
          let tier = "free";
          const plusPriceId = process.env.STRIPE_PRICE_ID_PLUS || process.env.VITE_STRIPE_PRICE_ID_PLUS;
          const proPriceId = process.env.STRIPE_PRICE_ID_PRO || process.env.VITE_STRIPE_PRICE_ID_PRO;

          console.log(`[StripeWebhook] Comparing prices - Input: ${priceId}, Plus: ${plusPriceId}, Pro: ${proPriceId}`);

          if (priceId === plusPriceId) {
            tier = "plus";
          } else if (priceId === proPriceId) {
            tier = "pro";
          } else {
            console.warn(`[StripeWebhook] Unknown priceId: ${priceId}. Defaulting to free.`);
          }

          console.log(`[StripeWebhook] Updating user ${userId} to tier: ${tier}`);

          const { error } = await supabase
            .from("profiles")
            .update({ 
              subscription_tier: tier,
              stripe_customer_id: session.customer as string,
              updated_at: new Date().toISOString()
            })
            .eq("id", userId);
          
          if (error) {
            console.error(`[StripeWebhook] Supabase Update Error: ${error.message}`);
            throw error;
          }
          console.log(`[StripeWebhook] ✓ Successfully updated user ${userId} to ${tier}`);
        } else {
          console.error(`[StripeWebhook] ERROR - Missing userId (${userId}) or Supabase client (${!!supabase}) or priceId (${priceId})`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items?.data?.[0]?.price?.id;

        console.log(`[StripeWebhook] Subscription updated. Customer: ${customerId}, Price: ${priceId}`);

        if (supabase && customerId) {
          const { data: profile, error: fetchError } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (fetchError) {
            console.error(`[StripeWebhook] Supabase Fetch Error: ${fetchError.message}`);
          } else if (profile && priceId) {
            let tier = "free";
            const plusPriceId = process.env.STRIPE_PRICE_ID_PLUS || process.env.VITE_STRIPE_PRICE_ID_PLUS;
            const proPriceId = process.env.STRIPE_PRICE_ID_PRO || process.env.VITE_STRIPE_PRICE_ID_PRO;

            if (priceId === plusPriceId) tier = "plus";
            else if (priceId === proPriceId) tier = "pro";

            console.log(`[StripeWebhook] Updating user ${profile.id} to tier: ${tier} (subscription updated)`);

            const { error: updateError } = await supabase
              .from("profiles")
              .update({ 
                subscription_tier: tier,
                updated_at: new Date().toISOString()
              })
              .eq("id", profile.id);
            
            if (updateError) {
              console.error(`[StripeWebhook] Update Error: ${updateError.message}`);
            } else {
              console.log(`[StripeWebhook] ✓ Successfully updated user ${profile.id} to ${tier}`);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`[StripeWebhook] Subscription deleted for customer: ${customerId}`);

        if (supabase) {
          const { data: profile, error: fetchError } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (fetchError) {
            console.error(`[StripeWebhook] Supabase Fetch Error: ${fetchError.message}`);
          } else if (profile) {
            console.log(`[StripeWebhook] Resetting user ${profile.id} to free tier.`);
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ 
                subscription_tier: "free",
                updated_at: new Date().toISOString()
              })
              .eq("id", profile.id);
            
            if (updateError) {
              console.error(`[StripeWebhook] Update Error: ${updateError.message}`);
            } else {
              console.log(`[StripeWebhook] ✓ Successfully reset user ${profile.id} to free`);
            }
          } else {
            console.warn(`[StripeWebhook] No profile found for customerId: ${customerId}`);
          }
        }
        break;
      }

      case "invoice.paid": {
        // Handle recurring invoice payments
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`[StripeWebhook] Invoice paid for customer: ${customerId}`);

        if (supabase && customerId && !invoice.paid) {
          console.warn(`[StripeWebhook] Invoice marked paid=false, skipping update`);
          break;
        }

        if (supabase && customerId) {
          const { data: profile, error: fetchError } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (fetchError) {
            console.error(`[StripeWebhook] Supabase Fetch Error: ${fetchError.message}`);
          } else if (profile) {
            // Get subscription to find current tier
            try {
              const subscriptions = await stripe?.subscriptions.list({
                customer: customerId,
                limit: 1,
              });
              
              const subscription = subscriptions?.data?.[0];
              const priceId = subscription?.items?.data?.[0]?.price?.id;
              
              if (priceId) {
                let tier = "free";
                const plusPriceId = process.env.STRIPE_PRICE_ID_PLUS || process.env.VITE_STRIPE_PRICE_ID_PLUS;
                const proPriceId = process.env.STRIPE_PRICE_ID_PRO || process.env.VITE_STRIPE_PRICE_ID_PRO;

                if (priceId === plusPriceId) tier = "plus";
                else if (priceId === proPriceId) tier = "pro";

                console.log(`[StripeWebhook] Invoice paid - user ${profile.id}, tier: ${tier}`);

                const { error: updateError } = await supabase
                  .from("profiles")
                  .update({ 
                    subscription_tier: tier,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", profile.id);
                
                if (updateError) {
                  console.error(`[StripeWebhook] Update Error: ${updateError.message}`);
                } else {
                  console.log(`[StripeWebhook] ✓ Invoice paid - user ${profile.id} tier maintained as ${tier}`);
                }
              }
            } catch (err) {
              console.error(`[StripeWebhook] Failed to fetch subscription for invoice: ${err}`);
            }
          }
        }
        break;
      }

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`[StripeWebhook] Unexpected Error: ${err.message}`);
    console.error(`[StripeWebhook] Stack Trace: ${err.stack}`);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
