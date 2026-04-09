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
} from '../_lib/stripeBilling';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const env = getBillingEnv();
    assertCreateCheckoutEnv(env);

    const planId = req.body?.planId;
    if (!planId) {
      throw new HttpError(400, 'Missing planId in request body');
    }

    const priceId = mapPlanToPriceId(planId, env);
    const user = await resolveUserFromAuthHeader(req.headers.authorization, env);

    const stripe = createStripeClient(env.stripeSecretKey);
    const adminClient = createSupabaseAdmin(env);

    const customerId = await ensureStripeCustomer({
      stripe,
      adminClient,
      userId: user.id,
      email: user.email,
    });

    const appUrl = getAppUrl(req, env.appUrl);

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

    return res.status(200).json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    console.error('[StripeCheckout] Failed to create checkout session:', error);
    return res.status(statusCode).json({
      error: error?.message || 'Unable to create checkout session',
      code: error?.type || 'checkout_session_error',
    });
  }
}
