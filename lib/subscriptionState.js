export const DEFAULT_PRO_PRICE_ID = 'price_1TRTQuGDw0P2L0A1MsgZiMeM';

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const ACCEPTED_CHECKOUT_PAYMENT_STATUSES = new Set(['paid', 'no_payment_required']);

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
  typeof expectedPriceId === 'string'
  && expectedPriceId.startsWith('price_')
  && Array.isArray(priceIds)
  && priceIds.includes(expectedPriceId)
);

export const deriveSubscriptionTier = ({
  currentTier,
  status,
  priceIds,
  expectedPriceId,
}) => {
  if (currentTier === 'owner') return 'owner';
  return isPaidSubscriptionStatus(status) && isExpectedPrice(priceIds, expectedPriceId)
    ? 'pro'
    : 'free';
};

export const stripeModeFromSecretKey = (secretKey) => {
  if (typeof secretKey !== 'string') return 'unknown';
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
};
