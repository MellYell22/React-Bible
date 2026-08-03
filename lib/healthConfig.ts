import { DEFAULT_PRO_PRICE_ID, stripeModeFromSecretKey } from './subscriptionState.js';

type Environment = Record<string, string | undefined>;

const isConfigured = (value: string | undefined) => Boolean(value?.trim());

export const getLaunchHealth = (env: Environment) => {
  const core = {
    OPENAI_API_KEY: isConfigured(env.OPENAI_API_KEY),
    ELEVENLABS_API_KEY: isConfigured(env.ELEVENLABS_API_KEY),
    ELEVENLABS_VOICE_ID: isConfigured(env.ELEVENLABS_VOICE_ID),
    VITE_SUPABASE_URL: isConfigured(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: isConfigured(env.VITE_SUPABASE_ANON_KEY),
    APP_URL: isConfigured(env.APP_URL),
  };

  const billing = {
    STRIPE_SECRET_KEY: isConfigured(env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: isConfigured(env.STRIPE_WEBHOOK_SECRET),
    SUPABASE_WRITE_KEY: isConfigured(
      env.SB_SECRET_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    STRIPE_PRICE_ID_PRO: isConfigured(env.STRIPE_PRICE_ID_PRO || DEFAULT_PRO_PRICE_ID),
  };

  const optional = {
    ELEVENLABS_MODEL: isConfigured(env.ELEVENLABS_MODEL),
    ELEVENLABS_OUTPUT_FORMAT: isConfigured(env.ELEVENLABS_OUTPUT_FORMAT),
  };

  const coreReady = Object.values(core).every(Boolean);
  const billingReady = Object.values(billing).every(Boolean);
  const launchReady = coreReady && billingReady;

  return {
    status: launchReady ? 'ok' : 'degraded',
    launchReady,
    allConfigured: launchReady,
    configured: core,
    billing: {
      configured: billing,
      ready: billingReady,
      stripeMode: stripeModeFromSecretKey(env.STRIPE_SECRET_KEY),
      usesDefaultProPriceId: !isConfigured(env.STRIPE_PRICE_ID_PRO),
    },
    optional,
  };
};
