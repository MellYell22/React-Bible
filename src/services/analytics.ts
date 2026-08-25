import { track } from '@vercel/analytics';

/**
 * The four moments that make up the funnel we actually care about:
 * install/visit -> signup -> paywall -> checkout -> paid.
 *
 * Every call site goes through this module rather than importing `track`
 * directly, so swapping the backend (PostHog, etc.) is a one-file change.
 *
 * Analytics must never break the product. Every export swallows its own
 * errors — a failed beacon is not worth an unhandled rejection in a
 * conversation someone is having at 2am.
 */

export type FunnelEvent =
  | 'signup'
  | 'chat_limit_reached'
  | 'checkout_started'
  | 'checkout_completed';

type Props = Record<string, string | number | boolean | null>;

/**
 * First-touch attribution. A visitor lands from a TikTok bio link tagged
 * `?utm_source=tiktok&utm_content=script1`, then signs up and pays days
 * later — by which point the URL is long gone. We stamp the first touch
 * once and attach it to every later event, which is what makes
 * "which clip converted" answerable at all.
 */
const SOURCE_KEY = 'bms_first_touch';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

type FirstTouch = Partial<Record<(typeof UTM_KEYS)[number], string>> & { referrer?: string };

const readFirstTouch = (): FirstTouch => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = window.localStorage.getItem(SOURCE_KEY);
    if (stored) return JSON.parse(stored) as FirstTouch;

    const params = new URLSearchParams(window.location.search);
    const touch: FirstTouch = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) touch[key] = value.slice(0, 64);
    }

    // Referrer is the fallback when a link has no UTMs on it — worth less
    // than a tagged link, but better than "direct" for everything.
    if (!touch.utm_source && document.referrer) {
      try {
        touch.referrer = new URL(document.referrer).hostname;
      } catch {
        /* malformed referrer — not worth recording */
      }
    }

    window.localStorage.setItem(SOURCE_KEY, JSON.stringify(touch));
    return touch;
  } catch {
    // Private browsing / disabled storage. Events still fire, just unattributed.
    return {};
  }
};

/** Call once on app boot so the first touch is stamped before any navigation. */
export const initAnalytics = (): void => {
  readFirstTouch();
};

export const trackEvent = (event: FunnelEvent, props: Props = {}): void => {
  try {
    track(event, { ...readFirstTouch(), ...props });
  } catch (error) {
    console.warn('[analytics] event dropped:', event, error);
  }
};
