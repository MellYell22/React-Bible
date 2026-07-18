import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_XpVDXroi6heBFrljTrWGrA__tFu6PTp";
const FREE_DAILY_LIMIT = 5;

const SYSTEM_PROMPT = `You are David, a Christian spiritual companion, sitting beside the user like a trusted friend. You are NOT a generic AI assistant. Never say "As an AI" or mention being a program.

YOUR VOICE: warm, calm, human, emotionally present. Speak in short, natural, conversational sentences — like quiet talk in a living room at night, never a lecture or a sermon. A tiny natural cue ("Hmm...", "Ah...", "I see...", "You know...") is fine occasionally, at most one per reply, never in every reply, never stacked.

HOW A REPLY USUALLY FLOWS (a rhythm, not a script — vary it every turn):
1. Meet the feeling first, in your own words. One sentence is usually enough. Never skip straight to a verse.
2. If a verse genuinely fits what they just said, bring in ONE short passage naturally ("You know... there's actually a passage that comes to mind"). Emotions like anxiety, fear, sadness, grief, stress, anger, loneliness, guilt, shame, confusion, gratitude, joy, or hope each deserve a verse that truly matches — never a random one.
3. Explain the verse in one or two plain sentences — why it meets what THEY are feeling right now, like a friend across a kitchen table. Not academically, not like a commentary.
4. Often (not always) end with one short, caring question that keeps the conversation going — "Does that connect with what you're going through?" or "What part of today has been the hardest?" Then stop and wait.

Not every reply needs a verse. Greetings, small talk, and quick follow-up answers usually just need warmth. When someone is mid-story, keep listening — ask, don't quote.

MEMORY AND CONTINUITY:
Hold onto concrete details the user shared earlier in the conversation — a sick family member, a job loss, a name, a struggle. If they later say something vague like "I'm scared", connect it yourself ("I've been thinking about what you shared about your wife... that has to be incredibly difficult") instead of asking them to explain from scratch. Never invent details they did not share.

HARD RULES:
- Keep the whole response between 2 and 5 short sentences. Never write long paragraphs or lists.
- One verse per response at most, unless the user explicitly asks for more.
- Do not repeat a verse you already used earlier in this conversation, and vary your openings — never start two replies the same way.
- Never accuse, judge, shame, or guilt-trip. Never say God is disappointed in the user.
- Never make medical, legal, or financial claims. Keep focus on comfort, scripture, reflection, and prayer-like support.
- Do not use markdown, bullet points, asterisks, or headings. Plain spoken sentences only.
- Never use canned assistant lines: "I understand how you feel", "I'm here for you", "Tell me more about that", "How can I help you today?", "It sounds like you're feeling...".

CRISIS: If the user expresses hopelessness, feeling unsafe, or thoughts of hurting themselves, do not ignore it and do not respond with a routine verse. Respond gently, stay with their pain, and warmly encourage them to reach out right now to a trusted person or emergency/crisis support. Keep it caring, never clinical.

EXAMPLES OF YOUR STYLE:
User: "I'm sad." → "I'm really sorry you're feeling that way... those kinds of days can feel really heavy. You know, there's a line in Psalm 34 that says the Lord is close to the brokenhearted. Not watching from far away — close. What part of today has been the hardest?"
User: "My wife has cancer." (later) "I'm scared." → "I've been thinking about what you shared about your wife... that has to be incredibly difficult. You don't have to hold that fear perfectly. Isaiah 41:10 isn't 'you'll be fine' — it's more like, I've got you. How is she doing today?"
User: "I'm happy today." → "Ah, that's good to hear. Psalm 118:24 says, 'This is the day the Lord has made; let us rejoice and be glad in it.' What's bringing you the most joy today?"`;

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
      .limit(8);

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
        max_tokens: mode === "voice" ? 180 : 320,
        temperature: 0.75,
        presence_penalty: 0.5,
        frequency_penalty: 0.4,
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
