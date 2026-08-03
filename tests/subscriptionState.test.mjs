import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRO_PRICE_ID,
  deriveSubscriptionTier,
  getStripeId,
  getSubscriptionPriceIds,
  isCheckoutPaymentAccepted,
  isExpectedPrice,
  isPaidSubscriptionStatus,
  stripeModeFromSecretKey,
} from '../lib/subscriptionState.js';

test('extracts Stripe IDs from strings and expandable objects', () => {
  assert.equal(getStripeId('cus_123'), 'cus_123');
  assert.equal(getStripeId({ id: 'cus_456' }), 'cus_456');
  assert.equal(getStripeId(null), null);
});

test('collects every subscription price ID', () => {
  assert.deepEqual(getSubscriptionPriceIds({
    items: { data: [{ price: { id: 'price_a' } }, { price: { id: 'price_b' } }] },
  }), ['price_a', 'price_b']);
});

test('accepts active and trialing subscriptions only', () => {
  assert.equal(isPaidSubscriptionStatus('active'), true);
  assert.equal(isPaidSubscriptionStatus('trialing'), true);
  assert.equal(isPaidSubscriptionStatus('past_due'), false);
  assert.equal(isPaidSubscriptionStatus('canceled'), false);
});

test('accepts paid checkout and no-payment-required trials', () => {
  assert.equal(isCheckoutPaymentAccepted('paid'), true);
  assert.equal(isCheckoutPaymentAccepted('no_payment_required'), true);
  assert.equal(isCheckoutPaymentAccepted('unpaid'), false);
});

test('requires the Bible Pro price instead of granting access for another app price', () => {
  assert.equal(isExpectedPrice([DEFAULT_PRO_PRICE_ID], DEFAULT_PRO_PRICE_ID), true);
  assert.equal(isExpectedPrice(['price_other_app'], DEFAULT_PRO_PRICE_ID), false);
});

test('preserves owner access during subscription cancellation', () => {
  assert.equal(deriveSubscriptionTier({
    currentTier: 'owner',
    status: 'canceled',
    priceIds: [DEFAULT_PRO_PRICE_ID],
    expectedPriceId: DEFAULT_PRO_PRICE_ID,
  }), 'owner');
});

test('grants Pro only for a paid Bible Pro subscription', () => {
  assert.equal(deriveSubscriptionTier({
    currentTier: 'free',
    status: 'trialing',
    priceIds: [DEFAULT_PRO_PRICE_ID],
    expectedPriceId: DEFAULT_PRO_PRICE_ID,
  }), 'pro');

  assert.equal(deriveSubscriptionTier({
    currentTier: 'pro',
    status: 'canceled',
    priceIds: [DEFAULT_PRO_PRICE_ID],
    expectedPriceId: DEFAULT_PRO_PRICE_ID,
  }), 'free');

  assert.equal(deriveSubscriptionTier({
    currentTier: 'free',
    status: 'active',
    priceIds: ['price_other_app'],
    expectedPriceId: DEFAULT_PRO_PRICE_ID,
  }), 'free');
});

test('detects Stripe mode from the secret-key prefix without exposing the key', () => {
  assert.equal(stripeModeFromSecretKey('sk_live_redacted'), 'live');
  assert.equal(stripeModeFromSecretKey('sk_test_redacted'), 'test');
  assert.equal(stripeModeFromSecretKey('redacted'), 'unknown');
});
