export const APP_NAME = 'Bible Mood Search';
export const AUTHOR_CREDIT = 'Created by AA Designs';

export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free Plan',
    price: '$0',
    interval: 'mo',
    priceId: null,
    features: [
      'Daily Verse of the Day',
      '5 chats a day with David',
      '1 reflection a day',
    ],
  },
  PLUS: {
    id: 'plus',
    name: 'Bible Plus',
    price: '$9.99',
    interval: 'mo',
    // No dead fallback: unset env means Plus checkout is unavailable, by design.
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PLUS || null,
    features: [
      'Unlimited text chat with David',
      'Expanded daily reflections',
      'Saved favorites & bookmarks',
      'Chat history sync',
      'Ad-free experience',
    ],
  },
  PRO: {
    id: 'pro',
    name: "David's Voice Pro",
    price: '$19.99',
    interval: 'mo',
    // No dead fallback: unset env means Pro checkout is unavailable, by design.
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO || null,
    features: [
      'Everything in Bible Plus',
      "1 hour of David's voice each month",
      'Deeper scripture reflections',
      'Priority responses',
    ],
  },
};
