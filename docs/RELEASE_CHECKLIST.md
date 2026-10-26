# CalVue — Release checklist

Open items before a store submission and what to verify after a deploy. Remove
lines as they are resolved. Last full pre-launch audit: 10 July 2026 (both
projects type-checked clean, no secrets in the repo).

## Repo hygiene, still open

- [ ] `mobile/calsnap.aab` (46 MB) is committed. `git rm --cached mobile/calsnap.aab` and add `*.aab` / `*.apk` to `.gitignore`.
- [ ] `mobile/package.json` `start` and `web` scripts set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Dev only, does not affect EAS builds, but remove once the local backend has a valid certificate.
- [ ] `ALLOWED_ORIGINS` must be set explicitly in Railway. It defaults to `*`.
- [ ] Apply the Supabase steps in `SETUP.md` section 4 (unique constraint, trial default, image purge) or turn them into migrations.
- [ ] Run migration `010_scan_feedback.sql` on production and redeploy the backend.
- [ ] Add a placeholder in History and Scan Result for logs whose `image_url` was purged.

## Before every upload

- [ ] `npx tsc --noEmit` passes in `mobile/` and `backend/`. Unit tests pass (`backend/src/routes/*.test.ts`).
- [ ] Clean install: `cd mobile && rm -rf node_modules && npm install --legacy-peer-deps && npx expo install --check`.
- [ ] `GEMINI_API_KEY`, `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH` present in the hosting environment.
- [ ] Test a real purchase on a device. Purchases are native and cannot be verified in Expo Go or in CI.
- [ ] Have `legal/PRIVACY_POLICY.md` and `legal/TERMS_OF_SERVICE.md` reviewed by a human before publishing.

## Google Play

- [ ] `versionCode` bumped (the Actions workflow does this automatically).
- [ ] 512×512 icon and 1024×500 feature graphic are in `store-assets/`. Add phone screenshots.
- [ ] Listing copy from `store-assets/play-store-listing.md`.
- [ ] Privacy Policy hosted and linked. Data Safety form filled: email, photos, health and activity data, purchase data.
- [ ] `SCHEDULE_EXACT_ALARM` needs a policy declaration. Inexact alarms for meal reminders avoid the review friction.

## Apple App Store (not yet targeted)

- [ ] Sign in with Apple is required alongside Google sign-in (Guideline 4.8). Not implemented.
- [ ] Camera, Photo Library and Motion usage strings are present.
- [ ] App Privacy questionnaire.
- [ ] Paywall must not mention third-party payment methods. Already clean after the RevenueCat rewrite.

## Verify after a deploy

- New account: 20 scans/day for 7 days, then 2/day.
- Free user's 3rd scan in a day → 402 and the paywall.
- Pro user's 21st scan in a day → 429 and the "Daily limit reached" alert, no paywall.
- Buy monthly and annual with a sandbox / license tester account. Pro unlocks without a reload.
- Restore Purchases on a second device.
- A sandbox cancellation eventually flips `is_subscribed` to false via the webhook.
- Old images gone after 90 days (test with a shorter interval), logs intact.
