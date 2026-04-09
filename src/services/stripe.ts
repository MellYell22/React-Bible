import { supabase } from './supabase';

export type UpgradePlanId = 'plus' | 'pro';

export const createCheckoutSession = async (planId: UpgradePlanId) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to upgrade your plan.');
  }

  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ planId }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to start checkout right now.');
  }

  if (!payload?.url) {
    throw new Error('Checkout session was created but no redirect URL was returned.');
  }

  window.location.assign(payload.url);
};
