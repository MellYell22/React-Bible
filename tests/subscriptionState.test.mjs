import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSubscriptionTier,
  getConfiguredTierPrices,
  getStripeId,
  getSubscriptionPriceIds,
  isCheckoutPaymentAccepted,
  isExpectedPrice,
  isPaidSubscriptionStatus,
  matchTierByPriceIds,
  resolveTierStrict,
  stripeModeFromSecretKey,
} from '../lib/subscriptionState.js';

// Test fixtures — real-looking price ids (never the old dead default).
const PLUS = 'price_TEST_plus_999';
const PRO = 'price_TEST_pro_1999';
const TIER_PRICES = { plus: PLUS, pro: PRO };

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

test('isExpectedPrice matches configured price and rejects others', () => {
  assert.equal(isExpectedPrice([PRO], PRO), true);
  assert.equal(isExpectedPrice(['price_other_app'], PRO), false);
  // Guards against a non-price fallback string.
  assert.equal(isExpectedPrice(['not_a_price'], 'not_a_price'), false);
});

test('detects Stripe mode from the secret-key prefix without exposing the key', () => {
  assert.equal(stripeModeFromSecretKey('sk_live_redacted'), 'live');
  assert.equal(stripeModeFromSecretKey('sk_test_redacted'), 'test');
  assert.equal(stripeModeFromSecretKey('redacted'), 'unknown');
});

// ---- multi-tier matching ----

test('matchTierByPriceIds resolves Plus and Pro', () => {
  assert.equal(matchTierByPriceIds([PLUS], TIER_PRICES), 'plus');
  assert.equal(matchTierByPriceIds([PRO], TIER_PRICES), 'pro');
  assert.equal(matchTierByPriceIds(['price_other'], TIER_PRICES), null);
  // Pro precedence if both somehow present.
  assert.equal(matchTierByPriceIds([PLUS, PRO], TIER_PRICES), 'pro');
});

test('getConfiguredTierPrices reads env and drops invalid/dead entries', () => {
  const prices = getConfiguredTierPrices({
    STRIPE_PRICE_ID_PLUS: PLUS,
    STRIPE_PRICE_ID_PRO: PRO,
  });
  assert.deepEqual(prices, { plus: PLUS, pro: PRO });

  // Blank / non-price values are ignored (no dead fallback).
  const partial = getConfiguredTierPrices({
    STRIPE_PRICE_ID_PLUS: '   ',
    STRIPE_PRICE_ID_PRO: 'not_a_price',
  });
  assert.deepEqual(partial, {});
});

// ---- strict resolver: the core money-bug guard ----

test('resolveTierStrict: Plus subscription resolves to plus', () => {
  assert.equal(resolveTierStrict({
    currentTier: 'free', status: 'active', priceIds: [PLUS], tierPrices: TIER_PRICES,
  }), 'plus');
});

test('resolveTierStrict: Pro subscription resolves to pro', () => {
  assert.equal(resolveTierStrict({
    currentTier: 'free', status: 'trialing', priceIds: [PRO], tierPrices: TIER_PRICES,
  }), 'pro');
});

test('resolveTierStrict: cancellation resolves to free', () => {
  assert.equal(resolveTierStrict({
    currentTier: 'pro', status: 'canceled', priceIds: [PRO], tierPrices: TIER_PRICES,
  }), 'free');
});

test('resolveTierStrict: owner is never downgraded', () => {
  assert.equal(resolveTierStrict({
    currentTier: 'owner', status: 'canceled', priceIds: [PRO], tierPrices: TIER_PRICES,
  }), 'owner');
  assert.equal(resolveTierStrict({
    currentTier: 'owner', status: 'active', priceIds: ['price_anything'], tierPrices: TIER_PRICES,
  }), 'owner');
});

test('resolveTierStrict: paid status with an unconfigured price THROWS (no silent downgrade)', () => {
  assert.throws(() => resolveTierStrict({
    currentTier: 'free',
    status: 'active',
    priceIds: ['price_unknown_dead'],
    tierPrices: TIER_PRICES,
    subscriptionId: 'sub_123',
  }), /unconfigured Stripe price/);
});

test('resolveTierStrict: paid status with no configured prices at all THROWS', () => {
  assert.throws(() => resolveTierStrict({
    currentTier: 'free',
    status: 'active',
    priceIds: [PRO],
    tierPrices: {},
  }), /unconfigured Stripe price/);
});

// ---- backward-compatible deriveSubscriptionTier (used by lib/stripeWebhook) ----

test('deriveSubscriptionTier: single expected pro price still grants pro', () => {
  assert.equal(deriveSubscriptionTier({
    currentTier: 'free', status: 'active', priceIds: [PRO], expectedPriceId: PRO,
  }), 'pro');
});

test('deriveSubscriptionTier: tierPrices map grants plus', () => {
  assert.equal(deriveSubscriptionTier({
    currentTier: 'free', status: 'active', priceIds: [PLUS], tierPrices: TIER_PRICES,
  }), 'plus');
});

test('deriveSubscriptionTier: owner preserved, other-app price -> free (non-throwing)', () => {
  assert.equal(deriveSubscriptionTier({
    currentTier: 'owner', status: 'canceled', priceIds: [PRO], expectedPriceId: PRO,
  }), 'owner');
  assert.equal(deriveSubscriptionTier({
    currentTier: 'free', status: 'active', priceIds: ['price_other_app'], expectedPriceId: PRO,
  }), 'free');
});
