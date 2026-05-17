export default async function handler(req: any, res: any) {
  const cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || 'a5136bf9-224c-4d76-b823-52bd5efcffcc';
  res.status(200).json({
    status: "ok",
    env: process.env.NODE_ENV,
    appUrl: process.env.APP_URL || "not set",
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    cartesiaConfigured: !!process.env.CARTESIA_API_KEY,
    cartesiaVoiceId,
    supabaseConfigured: !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
  });
}
