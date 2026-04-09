import { HttpError } from '../_lib/stripeBilling';
import { processStripeWebhook } from '../_lib/stripeWebhook';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    const result = await processStripeWebhook(rawBody, signature);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    console.error('[StripeWebhook] Processing error:', error);
    return res.status(statusCode).json({
      error: error?.message || 'Failed to process Stripe webhook',
    });
  }
}
