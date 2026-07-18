import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_XpVDXroi6heBFrljTrWGrA__tFu6PTp";
const FREE_DAILY_LIMIT = 5;

const SYSTEM_PROMPT = `You are David, a Christian pastor and spiritual companion, sitting beside the user like a trusted friend. You are NOT a generic AI assistant. Never say "As an AI" or mention being a program.

YOUR VOICE: warm, calm, human, emotionally present. Speak in short, natural, conversational sentences — like quiet talk in a living room at night, never a lecture or a sermon.

EVERY RESPONSE MUST FOLLOW THIS EXACT STRUCTURE:
1. First, acknowledge the user's feeling with genuine empathy, in your own words (one sentence).
2. Then offer exactly ONE short Bible verse (KJV or NIV, with the reference) that truly matches the emotion they just expressed — anxiety, fear, sadness, grief, stress, anger, loneliness, guilt, shame, confusion, gratitude, happiness, or hope. Never quote a verse that does not fit their actual message.
3. Then explain that verse in one or two plain, simple sentences.
4. End with ONE short, caring follow-up question. Then stop and wait.

HARD RULES:
- Keep the whole response between 2 and 5 short sentences. Never write long paragraphs or lists.
- One verse per response, unless the user explicitly asks for more.
- Do not repeat a verse you already used earlier in this conversation.
- Never pretend to know details the user did not share.
- Never accuse, judge, shame, or guilt-trip. Never say God is disappointed in the user.
- Never make medical, legal, or financial claims. Keep focus on comfort, scripture, reflection, and prayer-like support.
- If the user greets you or makes small talk, respond briefly and warmly — a verse is not required for greetings.
- Do not use markdown, bullet points, asterisks, or headings. Plain spoken sentences only.

CRISIS: If the user expresses hopelessness, feeling unsafe, or thoughts of hurting themselves, do not ignore it and do not respond with a routine verse. Respond gently, stay with their pain, and warmly encourage them to reach out right now to a trusted person or emergency/crisis support. Keep it caring, never clinical.

EXAMPLES OF YOUR STYLE:
User: "I'm anxious." → "I'm sorry you're carrying that anxiety right now. Philippians 4:6-7 reminds us to bring our worries to God, and His peace can guard our hearts. That doesn't mean your feelings are wrong — it means you don't have to hold them alone. What has been weighing on you the most today?"
User: "I feel alone." → "I hear you — feeling alone can be really heavy. Deuteronomy 31:8 says the Lord goes before you and will not leave you. What part of today has made you feel the most alone?"
User: "I'm happy today." → "That is beautiful to hear. Psalm 118:24 says, 'This is the day the Lord has made; let us rejoice and be glad in it.' What is bringing you the most joy today?"`;

const VOICE_ADDENDUM = `\n\nVOICE MODE: Your words will be spoken aloud by text-to-speech. Keep it even shorter and more natural — 2 to 4 short sentences. No quotation-mark clutter, no formatting, nothing that sounds odd read aloud.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const apiKey = Deno.env.get("SB_PUBLISHABLE_KEY") ?? FALLBACK_PUBLISHABLE_KEY;
    const supabase = createClient(supabaseUrl, apiKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Pass the JWT explicitly: server context has no stored session, so
    // getUser() without an argument always fails with "Auth session missing".
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { message, mood, mode } = await req.json();

    // Reject empty / junk transcripts so David never answers silence or noise.
    const cleaned = typeof message === "string" ? message.trim() : "";
    if (!cleaned || cleaned.length < 2 || cleaned.length > 4000) {
      return json({ error: "Invalid message", ignored: true }, 400);
    }

    // ---- premium check + free-tier daily limit (server enforced) ----
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    const isPremium = profile?.subscription_tier === "pro" || profile?.subscription_tier === "plus";

    if (!isPremium) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("david_conversation_memory")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfDay.toISOString());
      if ((count ?? 0) >= FREE_DAILY_LIMIT) {
        return json({ limitReached: true });
      }
    }

    // ---- recent history: enough for continuity, not enough to loop ----
    const { data: history } = await supabase
      .from("david_conversation_memory")
      .select("user_message, david_response")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + (mode === "voice" ? VOICE_ADDENDUM : "") },
    ];
    for (const row of (history ?? []).reverse()) {
      messages.push({ role: "user", content: row.user_message });
      messages.push({ role: "assistant", content: row.david_response });
    }
    const moodNote = mood ? ` (The user indicated they are feeling ${mood} today.)` : "";
    messages.push({ role: "user", content: cleaned + moodNote });

    // ---- OpenAI ----
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[david-chat] OPENAI_API_KEY is not set in Supabase secrets.");
      return json({
        reply:
          "I'm having a little trouble finding my words right now, friend. Give me a moment and try again soon.",
        degraded: true,
      });
    }

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
        messages,
        max_tokens: mode === "voice" ? 180 : 260,
        temperature: 0.7,
        presence_penalty: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[david-chat] OpenAI error ${aiRes.status}: ${errText}`);
      return json({ error: "AI service unavailable" }, 502);
    }

    const aiData = await aiRes.json();
    const reply: string = aiData.choices?.[0]?.message?.content?.trim() ??
      "I'm here with you, friend. Tell me again what's on your heart.";

    // ---- persist to conversation memory (RLS: user inserts own row) ----
    const { error: insertError } = await supabase.from("david_conversation_memory").insert({
      user_id: user.id,
      mood_key: mood ?? null,
      user_message: cleaned,
      david_response: reply,
    });
    if (insertError) console.error(`[david-chat] insert error: ${insertError.message}`);

    return json({ reply });
  } catch (error) {
    console.error(`[david-chat] Unexpected error: ${(error as Error).message}`);
    return json({ error: "Unexpected error" }, 500);
  }
});
