# CalSnap — New Pricing & Limits Rollout

Implements the agreed structure:

| Tier | Scans | Notes |
|---|---|---|
| **Trial** (new users, 7 days) | 20/day | Feels like Pro; no card required |
| **Free** (after trial) | 2/day | Down from 3 |
| **Pro** | 20/day (fair use) | ₹199/mo · ₹1299/yr |

Images are deleted after 90 days; logs are kept.

---

## 1. Code changes (done)

**Backend**
- `analyze.ts` — tiered scan gate: free = **2/day**, pro & trial = **20/day** fair use. Free over limit → **402** `scan_limit_reached` (paywall). Pro/trial over limit → **429** `daily_limit_reached` (no paywall, "resets tomorrow"). New `PRO_DAILY_SCAN_LIMIT = 20`.
- `subscription.ts` — `FREE_DAILY_SCAN_LIMIT` 3 → 2 (keeps `/status` in sync).
- `admin.ts` — MRR now computed at ₹199 (19900 paise) monthly and ₹1299/12 (10825 paise) annual.
- `types/shared.ts` — added `DailyLimitError`.

**Mobile**
- `useSubscriptionGate.ts` — free daily limit 3 → 2.
- `ScanScreen.tsx` — handles the new 429 with a friendly "Daily limit reached" alert (402 still opens the paywall).

Trial users are already treated as Pro by the gate (`trial_end_date` in the future ⇒ 20/day). Prices are read live from RevenueCat, so no price is hard-coded in the app.

---

## 2. Database — grant every new user a 7-day trial

The gate reads `profiles.trial_end_date`. It must be set to **now + 7 days** when a profile is created. Pick whichever matches your setup:

**Option A — column default (simplest):**
```sql
alter table public.profiles
  alter column trial_end_date set default (now() + interval '7 days');
```
This applies only when the inserting code doesn't set the column explicitly.

**Option B — in your signup trigger** (if you have a `handle_new_user()` function that inserts into `profiles`), add:
```sql
trial_end_date => now() + interval '7 days'
```

**Optional backfill** for users who signed up in the last week and never got a trial:
```sql
update public.profiles
set trial_end_date = created_at + interval '7 days'
where trial_end_date is null
  and created_at > now() - interval '7 days';
```

---

## 3. Database — delete food images after 90 days

Requires the `pg_cron` extension (Supabase → Database → Extensions → enable `pg_cron`). Runs daily at 03:00 UTC: removes old storage objects and clears the stale `image_url` on the logs (the nutrition data stays).

```sql
select cron.schedule(
  'purge-old-food-images',
  '0 3 * * *',
  $$
    delete from storage.objects
    where bucket_id = 'food-images'
      and created_at < now() - interval '90 days';

    update public.food_logs
    set image_url = null
    where logged_at < now() - interval '90 days'
      and image_url is not null;
  $$
);
```

**Also update the app UI** so History and the Scan Result screen show a graceful placeholder when `image_url` is null/expired (otherwise old entries render a broken image). Small change — tell me and I'll add the fallback.

---

## 4. Store / RevenueCat — set the new prices

No code change; prices come from the stores via RevenueCat.
- **App Store Connect** → your subscription products → set India price to **₹199** (monthly) and **₹1299** (annual); set intentional prices for other territories (don't rely on raw FX conversion).
- **Google Play Console** → Subscriptions → same two price points.
- **RevenueCat** → confirm the Monthly/Annual packages in your "current" offering still map to these products. The paywall auto-shows the localized price and recomputes the "Save X%" badge.

Tip: because you have no live conversion data yet, consider a RevenueCat **price experiment** (₹149 vs ₹199) once you have traffic, instead of treating ₹199 as final.

---

## 5. Quick verification after deploy
- New account → confirm 20/day for 7 days, then 2/day.
- Free user's 3rd scan in a day → paywall (402).
- Pro user's 21st scan in a day → "Daily limit reached" alert (429), **not** a paywall.
- After 90 days (or test with a shorter interval) → old images gone, logs intact, UI shows placeholder.
