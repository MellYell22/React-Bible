import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import Stripe from 'https://esm.sh/stripe@20.4.0';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const stripePriceIdPlus = Deno.env.get('STRIPE_PRICE_ID_PLUS');
const stripePriceIdPro = Deno.env.get('STRIPE_PRICE_ID_PRO');

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = (supabaseUrl && supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!stripe || !stripeWebhookSecret) {
        console.error('Stripe webhook configuration missing');
        return new Response('Webhook Error: Configuration missing', { status: 400 });
    }

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
        return new Response('Webhook Error: Missing signature', { status: 400 });
    }

    let event;
    try {
        const body = await req.text();
        event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.client_reference_id;
                const priceId = session.line_items?.data[0]?.price?.id;

                if (userId && supabase) {
                    let tier = 'free';
                    if (priceId === stripePriceIdPlus) tier = 'plus';
                    if (priceId === stripePriceIdPro) tier = 'pro';

                    await supabase
                        .from('profiles')
                        .update({ subscription_tier: tier })
                        .eq('id', userId);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                if (supabase) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', customerId)
                        .single();

                    if (profile) {
                        await supabase
                            .from('profiles')
                            .update({ subscription_tier: 'free' })
                            .eq('id', profile.id);
                    }
                }
                break;
            }
        }
        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error(`Database Error: ${err.message}`);
        return new Response('Internal Server Error', { status: 500 });
    }
}