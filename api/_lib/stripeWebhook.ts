import Stripe from 'stripe';
import {
  assertWebhookEnv,
  createStripeClient,
  createSupabaseAdmin,
  getBillingEnv,
  getPlanFromPriceId,
  HttpError,
} from './stripeBilling';

function toIsoDateFromUnix(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

async function updateProfileSubscriptionState(params: {
  adminClient: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
  plan: 'free' | 'plus' | 'pro';
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const { adminClient, userId, plan, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd } = params;

  const { error } = await adminClient
    .from('profiles')
    .update({
      subscription_tier: plan,
      subscription_status: status,
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId || null,
      subscription_current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update profile subscription state: ${error.message}`);
  }
}

async function upsertSubscriptionRow(params: {
  adminClient: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string;
  plan: 'free' | 'plus' | 'pro';
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const { adminClient, userId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodEnd, cancelAtPeriodEnd } = params;

  const { error } = await adminClient.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId,
      plan,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: !!cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (error) {
    console.warn('[StripeWebhook] subscriptions upsert failed (table may not exist):', error.message);
  }
}

async function resolveUserIdByCustomer(adminClient: ReturnType<typeof createSupabaseAdmin>, customerId: string) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user by stripe_customer_id: ${error.message}`);
  }

  return data?.id || null;
}

function extractPriceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items.data[0];
  return firstItem?.price?.id || null;
}

export async function processStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const env = getBillingEnv();
  assertWebhookEnv(env);

  if (!signature) {
    throw new HttpError(400, 'Missing stripe-signature header');
  }

  const stripe = createStripeClient(env.stripeSecretKey);
  const adminClient = createSupabaseAdmin(env);

  const event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  console.log(`[StripeWebhook] Event received: ${event.id} (${event.type})`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId || session.client_reference_id;
      if (!userId) {
        throw new Error('checkout.session.completed missing user identifier metadata');
      }

      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!stripeSubscriptionId) {
        throw new Error('checkout.session.completed missing subscription id');
      }

      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const priceId = extractPriceIdFromSubscription(subscription);
      const plan = getPlanFromPriceId(priceId, env);
      const currentPeriodEnd = toIsoDateFromUnix(subscription.current_period_end);

      await updateProfileSubscriptionState({
        adminClient,
        userId,
        plan,
        status: subscription.status,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        stripeSubscriptionId,
        currentPeriodEnd,
      });

      await upsertSubscriptionRow({
        adminClient,
        userId,
        stripeSubscriptionId,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        plan,
        status: subscription.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      const userId = subscription.metadata?.userId || (customerId ? await resolveUserIdByCustomer(adminClient, customerId) : null);
      if (!userId) {
        console.warn('[StripeWebhook] Unable to resolve user for subscription event', subscription.id);
        break;
      }

      const priceId = extractPriceIdFromSubscription(subscription);
      const plan = getPlanFromPriceId(priceId, env);
      const currentPeriodEnd = toIsoDateFromUnix(subscription.current_period_end);

      await updateProfileSubscriptionState({
        adminClient,
        userId,
        plan,
        status: subscription.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd,
      });

      await upsertSubscriptionRow({
        adminClient,
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        plan,
        status: subscription.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      const userId = subscription.metadata?.userId || (customerId ? await resolveUserIdByCustomer(adminClient, customerId) : null);

      if (!userId) {
        console.warn('[StripeWebhook] Unable to resolve user for deleted subscription', subscription.id);
        break;
      }

      await updateProfileSubscriptionState({
        adminClient,
        userId,
        plan: 'free',
        status: subscription.status || 'canceled',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: toIsoDateFromUnix(subscription.current_period_end),
      });

      await upsertSubscriptionRow({
        adminClient,
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        plan: 'free',
        status: subscription.status || 'canceled',
        currentPeriodEnd: toIsoDateFromUnix(subscription.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
      break;
    }

    default:
      console.log(`[StripeWebhook] Ignored event type: ${event.type}`);
  }

  return { received: true, type: event.type, id: event.id };
}
