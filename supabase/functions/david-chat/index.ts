const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DAVID_CHAT_UPSTREAM = 'https://www.mybibleaicompanion.com/api/david-chat';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ code: 'AUTH_REQUIRED', error: 'Please sign in again.' }, 401);
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  try {
    const upstream = await fetch(DAVID_CHAT_UPSTREAM, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body,
      redirect: 'follow',
    });

    const responseBody = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    if (!upstream.ok) {
      console.error(`[david-chat] Upstream returned ${upstream.status}: ${responseBody.slice(0, 300)}`);
    }

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`[david-chat] Upstream request failed: ${(error as Error).message}`);
    return json({
      code: 'AI_UPSTREAM_UNAVAILABLE',
      error: 'David is temporarily unavailable. Please try again shortly.',
    }, 503);
  }
});
