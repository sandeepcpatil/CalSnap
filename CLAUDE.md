# CalVue — project context for Claude

CalVue (package `com.sanverse.calsnapapp`, repo name CalSnap) is an AI calorie
counter for the Indian market. Users photograph a meal or scan a nutrition
label / barcode and get calories, macros and a 0–100 health score.

## Stack
- Mobile: Expo SDK 52 / React Native 0.76, TypeScript, Zustand, React Native Paper
- Backend: Node.js + Express + TypeScript, port 4000, deployed on Railway
- Database: Supabase (Postgres, Auth, Storage). Schema in `database/schema.sql`, migrations in `database/migrations/`
- AI: Gemini 2.5 Flash (`@google/generative-ai`)
- Auth: native Google Sign-In → `supabase.auth.signInWithIdToken`
- Payments: RevenueCat over StoreKit / Google Play Billing. Entitlement id `pro`
- Admin: Vite + React + Tailwind, deployed on Vercel
- Android builds: GitHub Actions (`.github/workflows/build-android.yml`)

## Key rules
- Enforce the scan gate server-side in `backend/src/routes/analyze.ts`. Free = 2 scans/day (402 → paywall), Pro and trial = 20/day fair use (429 → "resets tomorrow"). Never trust the client.
- `profiles.is_subscribed` + `subscription_end_date` are the source of truth for Pro. They are written only by `POST /api/subscription/sync` and the RevenueCat webhook.
- Supabase service role key lives in the backend only. RLS on every table.
- Zustand only for global state. No Redux, no Context.
- Theme tokens come from `mobile/src/theme/` (`colors`, `typography`, `spacing`, `radius`, `shadows`). Do not hardcode colour objects in screens.
- Compress images to max 1024px before upload.
- No new dependencies without asking first. A native dependency forces a full rebuild.
- No `console.log` in production code.

## Folders
```
mobile/     Expo app
backend/    Express API
admin/      Vite admin panel
database/   schema.sql + numbered migrations
legal/      Privacy policy, terms (Markdown, served by the app)
store-assets/  Play Store listing copy and graphics
docs/       Everything else, see below
```

## Run
- Backend: `cd backend && npm run dev`
- Mobile: `cd mobile && npx expo start` (Google Sign-In and purchases need a dev build, not Expo Go: `npx expo run:android`)
- Admin: `cd admin && npm run dev` (port 5173)
- Type-check before finishing: `npx tsc --noEmit` in `mobile/` and `backend/`

## Docs
- `docs/SETUP.md` — environment variables, Google Sign-In, RevenueCat, one-time Supabase steps, store pricing
- `docs/ROADMAP.md` — positioning, pricing model, growth-plan tracker, product backlog, anti-features
- `docs/RELEASE_CHECKLIST.md` — open items before a store submission and what to verify after a deploy
