// Single source of truth for subscription tier logic.
//
// IMPORTANT: There is intentionally NO hardcoded default price ID here.
// A missing/misconfigured Stripe price must fail loudly (or resolve to a
// non-paid tier) rather than silently falling back to a dead test price,
// which previously caused paying customers to be treated as free.

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const ACCEPTED_CHECKOUT_PAYMENT_STATUSES = new Set(['paid', 'no_payment_required']);

// Environment variable names for each paid tier's Stripe price.
export const PRICE_ENV_BY_TIER = Object.freeze({
  plus: 'STRIPE_PRICE_ID_PLUS',
  pro: 'STRIPE_PRICE_ID_PRO',
});

const isValidPriceId = (value) => typeof value === 'string' && value.startsWith('price_');

export const getStripeId = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;
  return null;
};

export const getSubscriptionPriceIds = (subscription) => {
  const items = subscription?.items?.data;
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => item?.price?.id)
    .filter((priceId) => typeof priceId === 'string' && priceId.length > 0);
};

export const isPaidSubscriptionStatus = (status) => PAID_SUBSCRIPTION_STATUSES.has(status);

export const isCheckoutPaymentAccepted = (paymentStatus) => (
  ACCEPTED_CHECKOUT_PAYMENT_STATUSES.has(paymentStatus)
);

export const isExpectedPrice = (priceIds, expectedPriceId) => (
  isValidPriceId(expectedPriceId)
  && Array.isArray(priceIds)
  && priceIds.includes(expectedPriceId)
);

// Reads configured tier prices from the environment. Only returns entries
// that look like real Stripe price IDs; missing/blank/invalid are dropped.
export const getConfiguredTierPrices = (env = (typeof process !== 'undefined' ? process.env : {})) => {
  const prices = {};
  for (const [tier, envName] of Object.entries(PRICE_ENV_BY_TIER)) {
    const value = env?.[envName]?.trim();
    if (isValidPriceId(value)) prices[tier] = value;
  }
  return prices;
};

// Given a set of price IDs on a subscription and a map of configured tier
// prices ({ plus, pro }), return which paid tier matches, or null.
export const matchTierByPriceIds = (priceIds, tierPrices) => {
  if (!Array.isArray(priceIds) || !tierPrices) return null;
  // Pro takes precedence if somehow both match (defensive).
  if (tierPrices.pro && priceIds.includes(tierPrices.pro)) return 'pro';
  if (tierPrices.plus && priceIds.includes(tierPrices.plus)) return 'plus';
  return null;
};

// Multi-tier resolver. Owner is always preserved. A paid status with an
// unrecognized price THROWS, so we never silently downgrade a real payer.
// Non-paid status resolves to 'free'.
export const resolveTierStrict = ({
  currentTier,
  status,
  priceIds,
  tierPrices,
  subscriptionId = 'unknown',
}) => {
  if (currentTier === 'owner') return 'owner';
  if (!isPaidSubscriptionStatus(status)) return 'free';

  const matched = matchTierByPriceIds(priceIds, tierPrices);
  if (matched) return matched;

  throw new Error(
    `Active subscription ${subscriptionId} uses an unconfigured Stripe price `
    + `(${(priceIds || []).join(', ') || 'none'}); refusing to silently downgrade.`,
  );
};

// Backward-compatible single-price resolver used by the existing webhook lib.
// Now delegates to the strict multi-tier logic. If only a single expected
// price is provided (legacy callers passing just proPriceId), it is treated
// as the Pro price. Unknown paid price -> 'free' here (non-throwing) to keep
// the existing lib/stripeWebhook.ts ignore-based flow intact; that lib already
// pre-filters with isExpectedPrice before calling.
/**
 * @param {{ currentTier?: any, status?: any, priceIds?: any, expectedPriceId?: any, tierPrices?: any }} args
 */
export const deriveSubscriptionTier = ({
  currentTier,
  status,
  priceIds,
  expectedPriceId,
  tierPrices,
} = {}) => {
  if (currentTier === 'owner') return 'owner';
  if (!isPaidSubscriptionStatus(status)) return 'free';

  const prices = tierPrices || (isValidPriceId(expectedPriceId) ? { pro: expectedPriceId } : {});
  return matchTierByPriceIds(priceIds, prices) || 'free';
};

export const stripeModeFromSecretKey = (secretKey) => {
  if (typeof secretKey !== 'string') return 'unknown';
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
};
