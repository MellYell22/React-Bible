import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  assertCreateCheckoutEnv,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomer,
  getAppUrl,
  getBillingEnv,
  HttpError,
  mapPlanToPriceId,
  resolveUserFromAuthHeader,
} from './api/_lib/stripeBilling';
import { processStripeWebhook } from './api/_lib/stripeWebhook';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await processStripeWebhook(req.body, typeof signature === 'string' ? signature : undefined);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    console.error('[StripeWebhook] Processing error:', error);
    return res.status(statusCode).json({
      error: error?.message || 'Failed to process Stripe webhook',
    });
  }
});

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const env = getBillingEnv();
    assertCreateCheckoutEnv(env);

    const planId = req.body?.planId;
    if (!planId) {
      throw new HttpError(400, 'Missing planId in request body');
    }

    const priceId = mapPlanToPriceId(planId, env);
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
    const user = await resolveUserFromAuthHeader(authHeader, env);

    const stripe = createStripeClient(env.stripeSecretKey);
    const adminClient = createSupabaseAdmin(env);

    const customerId = await ensureStripeCustomer({
      stripe,
      adminClient,
      userId: user.id,
      email: user.email,
    });

    const appUrl = getAppUrl(req as any, env.appUrl);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        planId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId,
        },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (error: any) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    console.error('[StripeCheckout] Failed to create checkout session:', error);
    return res.status(statusCode).json({
      error: error?.message || 'Unable to create checkout session',
      code: error?.type || 'checkout_session_error',
    });
  }
});

app.get('/api/health', (req, res) => {
  const env = getBillingEnv();
  res.json({
    status: 'ok',
    stripeConfigured: !!env.stripeSecretKey,
    supabaseConfigured: !!(env.supabaseUrl && env.supabaseServiceRoleKey),
    env: process.env.NODE_ENV,
    appUrl: env.appUrl || 'not set',
  });
});

app.all('/api/*', (req, res) => {
  console.warn(`[Server] 404 on API route: ${req.method} ${req.url}`);
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Server Error] ${err.stack || err.message}`);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`APP_URL: ${process.env.APP_URL || 'not set (defaulting to request origin)'}`);
    });
  }
}

startServer();
