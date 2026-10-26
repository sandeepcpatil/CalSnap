# CalVue — Setup

Everything that has to be configured outside the code: environment variables,
Google Sign-In, RevenueCat, one-time Supabase steps, store prices. Run commands
are in the root `CLAUDE.md`.

---

## 1. Environment variables

Never commit `.env` files. Copy `mobile/.env.example` and `backend/.env.example`
and fill them from the dashboards below.

**Mobile (`mobile/.env`)**

| Variable | Where it comes from |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project settings → API (anon key only) |
| `EXPO_PUBLIC_BACKEND_URL` | Railway backend URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud, Web OAuth client (section 2) |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | `com.googleusercontent.apps.<iOS client ID>` (section 2) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat public iOS key (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public Android key (`goog_…`) |
| `EXPO_PUBLIC_REVENUECAT_WEB_BILLING_KEY` | RevenueCat web billing key, optional |

**Backend (`backend/.env`, also set in Railway)**

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never ship to mobile |
| `GEMINI_API_KEY` | Required. The analyze route throws on boot without it |
| `REVENUECAT_SECRET_KEY` | RevenueCat secret v1 key, server only |
| `REVENUECAT_WEBHOOK_AUTH` | Long random string, must match the webhook header (section 3) |
| `ALLOWED_ORIGINS` | Comma-separated. Defaults to `*` when unset, so set it in production |
| `PORT` | Defaults to 4000 |

---

## 2. Google Sign-In

The app uses native Google Sign-In (`@react-native-google-signin/google-signin`
→ `supabase.auth.signInWithIdToken`). It shows a native account picker branded
CalVue and does not run in Expo Go.

**Google Cloud Console → Credentials.** Create three OAuth 2.0 client IDs in one project:

1. **Web application.** Authorized redirect URI: `https://skhgyotzqjnwasuugzva.supabase.co/auth/v1/callback`. Copy its client ID and secret. This is the `webClientId` the app and Supabase use.
2. **Android.** Package `com.sanverse.calsnapapp` (and `.dev` for the dev variant). Register the SHA-1 of every signing key: debug / dev-client, and the EAS or Play App Signing release key. A missing SHA-1 fails with `DEVELOPER_ERROR`.
3. **iOS.** Bundle `com.sanverse.calsnapapp` (and `.dev`). Its reversed client ID is the iOS URL scheme.

**OAuth consent screen.** App name `CalVue`, logo, support email, developer contact. This is what the sign-in sheet shows.

**Supabase → Auth → Providers → Google.** Enable, paste the Web client ID and secret, and add the Web, iOS and Android client IDs to *Authorized Client IDs*. Without this `signInWithIdToken` rejects native tokens.

Notes:
- No Firebase / `google-services.json` needed.
- `expo-auth-session` and `expo-web-browser` remain installed but are not used for sign-in.
- Apple Guideline 4.8: shipping Google sign-in on iOS requires Sign in with Apple too. Not added yet.

---

## 3. RevenueCat payments

Subscriptions go through StoreKit on iOS and Google Play Billing on Android via
`react-native-purchases`. Razorpay was removed. The entitlement identifier in
code is **`pro`**.

**Store products.** Create an auto-renewing subscription in both stores with product ids
`calsnap_pro_monthly` and `calsnap_pro_annual`. The backend infers the plan from
the product id containing `annual` or `year` (`planFromProductId` in
`backend/src/routes/subscription.ts`).

**RevenueCat dashboard.**
1. Project with the iOS and Android apps (bundle / package `com.sanverse.calsnapapp`).
2. Connect App Store Connect (in-app purchase key) and Google Play (service account with Pub/Sub and Play Developer API access).
3. Entitlements → create `pro`, attach both products.
4. Offerings → the *current* offering needs a **Monthly** and an **Annual** package. The paywall reads `offering.monthly` and `offering.annual` and shows localized prices, so no price is hardcoded in the app.
5. Integrations → Webhooks → URL `https://<backend>/api/subscription/webhook`, Authorization header value equal to `REVENUECAT_WEBHOOK_AUTH`. The backend expects an exact `Bearer <value>` match.
6. API keys → public iOS and Android keys for mobile, secret v1 key for the backend.

**How the flow works.** On launch `configurePurchases()`; on login `identifyUser(supabaseUserId)`. After a purchase the app calls `POST /api/subscription/sync`, which reads the entitlement from RevenueCat and flips `profiles.is_subscribed` immediately. Renewals, cancellations and billing issues arrive via the webhook and re-sync. *Restore Purchases* re-checks entitlements.

**Fees.** Apple / Google take 15–30%. RevenueCat is free up to $2,500/month tracked revenue, then 1%.

---

## 4. Supabase one-time steps

Run numbered files in `database/migrations/` in order. Latest: `010_scan_feedback.sql`.

The following are **not yet in a migration** and must be applied by hand:

**4a. Unique constraint for the subscription upsert.** The sync and webhook upsert on `user_id`.
```sql
alter table public.subscriptions add constraint subscriptions_user_id_key unique (user_id);
```
The old `razorpay_subscription_id` and `amount_paise` columns are no longer written and can be dropped.

**4b. Seven-day trial for every new user.** The scan gate reads `profiles.trial_end_date`.
```sql
alter table public.profiles
  alter column trial_end_date set default (now() + interval '7 days');
```
If a `handle_new_user()` trigger inserts the profile explicitly, set the column there instead. Optional backfill for recent signups:
```sql
update public.profiles
set trial_end_date = created_at + interval '7 days'
where trial_end_date is null and created_at > now() - interval '7 days';
```

**4c. Delete food images after 90 days.** Enable the `pg_cron` extension first. Nutrition data stays, only the photo and `image_url` go.
```sql
select cron.schedule('purge-old-food-images', '0 3 * * *', $$
  delete from storage.objects
  where bucket_id = 'food-images' and created_at < now() - interval '90 days';
  update public.food_logs set image_url = null
  where logged_at < now() - interval '90 days' and image_url is not null;
$$);
```
History and Scan Result need a placeholder when `image_url` is null.

**4d. Storage.** Bucket `food-images`, private, signed URLs with 1-hour expiry.

---

## 5. Store pricing

Prices live in the stores, not the code. Current structure:

| Tier | Scans | Price |
|---|---|---|
| Trial (first 7 days) | 20/day | free, no card |
| Free | 2/day | free |
| Pro | 20/day fair use | ₹199/month, ₹1,299/year |

Set India prices in App Store Connect and Google Play Console, and set intentional
prices for other territories rather than raw FX conversion. The admin MRR
calculation in `backend/src/routes/admin.ts` assumes these two price points and
must be updated if they change. Consider a RevenueCat price experiment (₹149 vs
₹199) once there is traffic.

---

## 6. Builds

```
cd mobile
npm install --legacy-peer-deps
npx expo install --check
npx expo run:android        # dev build with native modules
eas build --profile development --platform android
```
Release builds run on GitHub Actions (`.github/workflows/build-android.yml`) with an auto-incremented `versionCode`.
