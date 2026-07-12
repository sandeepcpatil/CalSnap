# CalSnap — RevenueCat Payments Setup

The app now uses **RevenueCat** (over StoreKit on iOS + Google Play Billing on Android) instead of Razorpay. The code changes are done; this guide covers the account/dashboard steps only **you** can do, plus how to test.

---

## What changed in the code

**Mobile**
- Added `react-native-purchases` and `expo-dev-client`; **removed** `react-native-razorpay`.
- New `src/services/purchases.ts` — configure, identify user, purchase, restore, entitlement check.
- `App.tsx` configures RevenueCat on launch and calls `identifyUser(supabaseUserId)` on login.
- `authStore.signOut()` calls `logOutPurchases()` (and the debug `console.log`s were removed).
- `PaywallModal.tsx` rewritten: loads RevenueCat offerings, shows **localized** prices, purchases via the store, adds a **Restore Purchases** button, and removed all Razorpay / UPI / CARD / NETBANKING branding (required for App Store approval).
- `app.config.js` `extra` now exposes `revenueCatIosKey` / `revenueCatAndroidKey`.

**Backend**
- `routes/subscription.ts` rewritten: `POST /sync` (reads entitlement from RevenueCat's REST API and updates Supabase immediately after purchase) + `POST /webhook` (authenticated by a shared secret; re-reads authoritative state) + `GET /status`. Razorpay order/webhook code removed.
- `index.ts` no longer needs the raw-body middleware.
- Removed the `razorpay` (and unused `openai`) dependencies.

**Entitlement identifier used in code:** `pro` — this must match the entitlement you create in RevenueCat.

---

## One-time setup

### 1. Store products
Create an auto-renewing subscription in **both** stores with matching logic:

- **App Store Connect** → your app → Subscriptions → create a group (e.g. "CalSnap Pro") with two products, e.g. `calsnap_pro_monthly` and `calsnap_pro_annual`. Set prices (INR + other territories).
- **Google Play Console** → Monetize → Subscriptions → create `calsnap_pro_monthly` and `calsnap_pro_annual` with base plans (monthly / yearly).

> The backend infers plan type from the product id containing "annual"/"year". Keep "annual" (or "year") in the annual product id, or adjust `planFromProductId` in `subscription.ts`.

### 2. RevenueCat dashboard
1. Create a project; add your iOS app (bundle `com.sanverse.calsnapapp`) and Android app (package `com.sanverse.calsnapapp`).
2. Connect App Store Connect (App-Specific Shared Secret / in-app purchase key) and Google Play (service-account JSON with the Pub/Sub + Play Developer API access).
3. **Entitlements** → create one with identifier exactly **`pro`**. Attach both products to it.
4. **Offerings** → create the "current" offering. Add two packages: a **Monthly** package (attach the monthly product) and an **Annual** package (attach the annual product). The paywall reads `offering.monthly` and `offering.annual`.
5. **API keys** → copy the **public** iOS key and **public** Android key, and the **secret** (v1) key.

### 3. Environment variables
Mobile `.env`:
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxx
```
Backend `.env`:
```
REVENUECAT_SECRET_KEY=sk_xxx          # secret v1 key — server only
REVENUECAT_WEBHOOK_AUTH=<any-long-random-string>
```

### 4. Webhook
RevenueCat dashboard → **Integrations → Webhooks**:
- URL: `https://<your-backend>/api/subscription/webhook`
- Authorization header value: the **same** string you set as `REVENUECAT_WEBHOOK_AUTH` (RevenueCat sends it as `Authorization: Bearer <value>`; the backend checks for an exact `Bearer <value>` match).

### 5. Supabase `subscriptions` table
The webhook/sync upserts on `user_id`, so add a **unique constraint on `subscriptions.user_id`** (or change `onConflict` in `subscription.ts`). The old `razorpay_subscription_id` / `amount_paise` columns are no longer written and can be dropped. The authoritative gate uses `profiles.is_subscribed` + `profiles.subscription_end_date`, which are updated on every sync/webhook.

### 6. Install & build
```
cd mobile
npm install                 # picks up react-native-purchases + expo-dev-client, drops razorpay
npx expo install --check    # align native versions
```
RevenueCat needs a **dev/production build**, not Expo Go, for real purchases (Expo Go runs it in preview/mock mode). You already build with EAS:
```
eas build --profile development --platform android   # or ios
```

---

## How the flow works

1. On launch, `configurePurchases()` runs; on login, `identifyUser(supabaseUserId)` ties purchases to the account.
2. The paywall loads the current offering and shows localized prices.
3. On purchase, StoreKit/Play handles payment → RevenueCat grants the `pro` entitlement → the app calls `POST /api/subscription/sync`, which reads the entitlement server-side and flips `profiles.is_subscribed` **immediately** (so the scan gate unlocks without waiting).
4. Renewals, cancellations, expirations, billing issues → RevenueCat fires the **webhook** → backend re-syncs Supabase.
5. **Restore Purchases** re-checks entitlements and re-syncs.

---

## Testing checklist

- iOS: create a **Sandbox tester** in App Store Connect; sign into it on a real device; buy monthly + annual; verify Pro unlocks and the scan gate lifts.
- Android: add **license testers** in Play Console; use an internal-testing build; buy both plans.
- Verify **Restore Purchases** on a fresh install / second device.
- Verify a **cancellation** (sandbox) eventually flips `is_subscribed` to false via the webhook.
- Confirm the paywall shows **no** mention of Razorpay/UPI/etc. (App Store requirement).

---

## Note on fees
Store billing means Apple/Google take **15–30%** (15% for most subscriptions after 12 months / under the small-business program). RevenueCat is free up to **$2,500/mo** tracked revenue, then **1%**. This is the required tradeoff for in-app digital subscriptions on both stores.
