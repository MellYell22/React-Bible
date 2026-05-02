import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

// Initialize Supabase - using Service Role Key for admin access
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  if (!sig || !webhookSecret) {
    console.error("[Stripe Webhook] Error: Missing signature or webhook secret");
    return res.status(400).send('Webhook Error: Missing signature or webhook secret');
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error: Verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  // Helper to find profile by Stripe ID or Email
  const findProfile = async (customerId: string, email: string | null, userIdFromMetadata?: string | null) => {
    console.log(`[Stripe Webhook] Debug: customerId=${customerId}, email=${email}, userIdFromMetadata=${userIdFromMetadata}`);
    
    // 1. Try metadata ID if provided
    if (userIdFromMetadata) {
      const { data } = await supabase.from('profiles').select('id, email, stripe_customer_id').eq('id', userIdFromMetadata).maybeSingle();
      if (data) {
        console.log(`[Stripe Webhook] User found by metadata ID: ${data.id}`);
        return data;
      }
    }

    // 2. Try Stripe Customer ID
    if (customerId) {
      const { data } = await supabase.from('profiles').select('id, email, stripe_customer_id').eq('stripe_customer_id', customerId).maybeSingle();
      if (data) {
        console.log(`[Stripe Webhook] User found by stripe_customer_id: ${data.id}`);
        return data;
      }
    }

    // 3. Fallback to Email
    if (email) {
      console.log(`[Stripe Webhook] Fallback: Searching by email ${email}`);
      const { data } = await supabase.from('profiles').select('id, email, stripe_customer_id').eq('email', email).maybeSingle();
      if (data) {
        console.log(`[Stripe Webhook] User found by email fallback: ${data.id}`);
        return data;
      }
    }

    console.log(`[Stripe Webhook] No user matched for customerId: ${customerId}, email: ${email}`);
    return null;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_details?.email || session.customer_email || null;
        const userIdMetadata = session.client_reference_id || session.metadata?.userId || session.metadata?.user_id;
        
        const profile = await findProfile(customerId, customerEmail, userIdMetadata);

        if (profile) {
          console.log(`[Stripe Webhook] Upgrading User ${profile.id} to Pro`);
          const { error } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              subscription_tier: 'pro',
              subscription_status: 'active',
              plan: 'pro',
              stripe_subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          if (error) {
            console.error(`[Stripe Webhook] Error upgrading profile for user ${profile.id}: ${error.message}`);
          } else {
            console.log(`[Stripe Webhook] User ${profile.id} upgrade succeeded.`);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const customerEmail = invoice.customer_email;
        const subscriptionId = invoice.subscription as string;

        const profile = await findProfile(customerId, customerEmail);

        if (profile) {
          const { error } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_tier: 'pro',
              subscription_status: 'active',
              plan: 'pro',
              stripe_subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
            
          if (error) console.error(`[Stripe Webhook] Error updating profile on invoice.paid: ${error.message}`);
          else console.log(`[Stripe Webhook] User ${profile.id} upgraded/confirmed Pro via invoice.paid`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const userIdMetadata = subscription.metadata?.userId || subscription.metadata?.user_id;
        const status = subscription.status;
        
        // Subscriptions don't have email in the object, so we might have to rely on ID or fetch
        // But let's check if metadata has it or if we can find it by ID first
        const profile = await findProfile(customerId, null, userIdMetadata);

        if (profile) {
          const tier = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_status: status === 'active' || status === 'trialing' ? 'active' : 'inactive',
              plan: tier,
              stripe_subscription_status: status,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          if (error) {
            console.error(`[Stripe Webhook] Error updating profile for ${event.type}: ${error.message}`);
          } else {
            console.log(`[Stripe Webhook] Updated user ${profile.id} status to ${status} (tier: ${tier}).`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const profile = await findProfile(customerId, null);

        if (profile) {
          const { error } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
              plan: 'free',
              stripe_subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          if (error) {
            console.error(`[Stripe Webhook] Error resetting profile on deletion: ${error.message}`);
          } else {
            console.log(`[Stripe Webhook] Reset user ${profile.id} to free tier.`);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`[Stripe Webhook] Fatal error processing webhook: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
