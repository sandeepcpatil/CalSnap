# CalSnap — Pre-Launch Test Report

**Date:** 10 July 2026
**Scope:** Mobile app (release readiness), security & secrets audit, backend API
**Verdict:** **Not yet ready to submit** — 3 blockers remain (mostly operational). Core code is healthy: both projects type-check clean and no secrets are leaked. Several issues were fixed in this pass; a few need your decision.

---

## Automated checks (run this session)

| Check | Result |
|---|---|
| Backend `tsc --noEmit` | **PASS** (0 errors) |
| Mobile `tsc --noEmit` | **PASS** (0 errors, after completing the dependency install) |
| Secret scan (whole repo) | **CLEAN** — no hardcoded keys; only `.env.example` templates are committed |
| `.env` committed to git? | **No** (correctly gitignored) |
| Required store assets present | icon ✓, adaptive-icon ✓, splash ✗ → **fixed** |

---

## Blockers — must resolve before submitting

**1. Backend is missing `GEMINI_API_KEY`.**
`backend/src/routes/analyze.ts` throws on startup if `GEMINI_API_KEY` is not set, and the whole backend imports that router — so without the key, the server won't boot and food scanning (the core feature) is dead. Your `backend/.env` currently has `OPENAI_API_KEY` (which the code does **not** use) but **not** `GEMINI_API_KEY`. Ensure `GEMINI_API_KEY` is set in your production hosting environment before go-live.

**2. Incomplete dependency install.**
`expo-sensors` and `expo-notifications` are declared in `package.json` but were absent from `node_modules` — a clean production build would fail on these. Run a clean install before building:
```
cd mobile && rm -rf node_modules && npm install --legacy-peer-deps && npx expo install --check
```
(Verified: once these are installed, the mobile app type-checks with zero errors.)

**3. iOS payments will likely be rejected (App Store only).**
Apple Guideline 3.1.1 requires digital subscriptions to use in-app purchase (StoreKit). Your subscription flow uses **Razorpay**, which is fine for Google Play but Apple generally does **not** allow it for digital goods. Plan to add StoreKit/IAP for the iOS build, or the App Store submission will bounce. (Play Store is unaffected — you can ship Android as-is.)

---

## Fixed in this pass

- **Broken splash screen** — `splash.png` was a 1×1-pixel placeholder (blank splash). Regenerated a proper 1242×2688 splash from your app icon on the brand teal (`#01696f`). Old file kept as `assets/splash.placeholder.bak.png`. Swap in a professionally designed splash when you have one.
- **Backend cache bug** (`analyze.ts`) — on a cache hit, `hit_count` was set to `supabase.rpc('increment_hit_count')`, i.e. a query-builder object assigned as a column value. That never increments and can corrupt the write. Replaced with a proper RPC call + `last_hit_at` update. *Note: for the counter to actually work you need a Postgres function `increment_hit_count(p_image_hash)`; if it doesn't exist the call degrades to a harmless no-op (analytics only).*
- **Camera "X" button did nothing** (`ScanScreen.tsx`) — the close button had no handler, so users could get stuck in the camera. Now returns to the Home tab. The "?" help button is now wired to a short how-to alert.
- **Scan counter didn't update** — `consumeScan()` was defined but never called; the "N scans left today" badge now decrements immediately after a successful scan (server remains authoritative).

---

## Needs your decision

**Payment success is shown too early.**
In `PaywallModal.tsx`, right after the Razorpay checkout sheet closes, the app calls `fetchProfile()` and shows "Welcome to Pro! 🎉". But the subscription is actually activated by the `subscription.activated` **webhook**, which is asynchronous — it may not have landed yet. Result: the user sees the success message while the app still treats them as a free user until the webhook arrives and they reload.
*Recommended fix (left for you, since it changes payment behavior):* after checkout, poll `GET /api/subscription/status` a few times (e.g. 5 attempts, 2s apart) and only declare Pro once `isSubscribed` flips — otherwise show an "Activating your subscription…" state. Want me to implement this?

---

## Medium / hygiene (not blockers)

- **`NODE_TLS_REJECT_UNAUTHORIZED=0`** in `mobile/package.json` `start`/`web` scripts disables TLS certificate validation. It's dev-only (does **not** affect EAS production builds), but it's a bad habit — remove once your local backend has a valid cert.
- **Unused `openai` dependency + `OPENAI_API_KEY`** in the backend (code uses Gemini). Remove to cut bloat and confusion.
- **`ADMIN_SECRET`** in `backend/.env` is never referenced in code (admin auth correctly uses the `admin_users` table). Dead config — remove or wire it up.
- **`calsnap.aab` (46 MB) is committed to git.** Bloats the repo and bakes build output into history. `git rm --cached mobile/calsnap.aab` and add it to `.gitignore`.
- **4 `console.log`/`warn` in `authStore.signOut`** — harmless, but your own coding rules say no `console.log` in production. Strip before release.
- **CORS `ALLOWED_ORIGINS` defaults to `'*'`** when unset. Set it explicitly to your admin/app origins in production.
- **Webhook signature check** (`subscription.ts`): `crypto.timingSafeEqual` throws if the attacker-supplied signature is a different length, returning 500 instead of 401. Minor — optionally compare lengths first.

---

## Store-submission checklist (do on your machine)

Google Play:
- Bump `versionCode` (currently 3) on every upload.
- Provide 512×512 store icon, 1024×500 feature graphic, phone screenshots.
- Host and link a **Privacy Policy** (you reference one in the paywall) and complete the **Data Safety** form — you collect email, photos, health/activity, and purchase data.
- `SCHEDULE_EXACT_ALARM` requires a Play policy declaration; consider inexact alarms for meal reminders to avoid review friction.

Apple App Store:
- Camera / Photo Library / Motion usage strings are present ✓.
- Complete the App Privacy questionnaire.
- Address the StoreKit/IAP requirement (Blocker #3).

Both:
- Test the **full Razorpay payment on a real device in sandbox** before release — it's a native module and can't be verified in this environment.
