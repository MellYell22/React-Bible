# Base44 Dev Environment

## What this app is
"Bible Mood Search — Meet David": a Vite + React + Express app where users search
Scripture by mood and chat with "David," an AI Bible companion with voice (TTS).
Uses react-native-web for the UI layer (React Native components compiled to web).

## How to run
```
docker compose -f docker-compose.base44.yml up -d
```
The app listens on **port 3000**. Health check: `GET /api/health`.

## Architecture
- **Single process**: `tsx server.ts` starts an Express server with Vite in
  middleware mode (dev). Express serves both the API (`/api/*`) and the Vite
  frontend. No separate frontend/backend services.
- **Package manager**: pnpm (via corepack, version pinned in package.json).
- **Build tools**: `node:22` full image (needed for `better-sqlite3` native build,
  even though better-sqlite3 is not imported anywhere — pnpm still builds it).

## External services (all optional — app degrades gracefully)
- **OpenAI** (`OPENAI_API_KEY`): chat, mood scriptures, verse of the day,
  reflections, Whisper transcription. Without it, chat returns fallback responses.
- **ElevenLabs** (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`): David's voice (TTS).
  Without it, the `/api/speech` endpoint returns a 503.
- **Supabase** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`): user auth, profiles, conversation memory, daily
  reflection limits. Without it, the app runs in guest mode (no sign-in).
- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_ID_PRO`): subscriptions.

## Secrets
Secrets are delivered via `/run/base44/app.env` (platform-managed, outside the
repo). Placeholder defaults in `.env.base44-defaults` let the app boot without
credentials; real secrets always override them (compose lists the defaults file
first, app.env last).

## Key files
- `server.ts` — Express server with all API routes and Vite middleware.
- `vite.config.ts` — Vite config (middleware mode, `allowedHosts: true` for preview).
- `src/App.tsx` — root component, routing, nav.
- `src/UserContext.tsx` — auth context (Supabase or guest mode).
- `src/services/supabase.ts` — frontend Supabase client (null if unconfigured).

## Dev notes
- Vite runs in middleware mode inside Express, so `server.host`/`allowedHosts`
  in vite.config.ts must be set to `true` for the preview's external hostname.
- `DISABLE_HMR=true` disables HMR (used by the original AI Studio environment).
- The app uses `react-native-web`; components import from `react-native` which
  is aliased to `react-native-web` in vite.config.ts.
