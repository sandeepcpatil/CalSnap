# CalSnap — Pro Model & Margin Analysis

*Analysis only — nothing implemented. Numbers are estimates with the assumptions stated at the end.*

## TL;DR

Your **per-unit margins are excellent** — the AI scan is absurdly cheap (~₹0.06 a scan), so on the monthly plan you keep ~90%+ after store fees even for a heavy user. The margin is **not** your problem.

Your real problems are three:
1. **Your free tier gives away the entire core job.** 3 free scans/day = breakfast, lunch, dinner. A disciplined user never needs to pay.
2. **"Unlimited" + the annual plan can go cash-negative on a heavy abuser.** Rare, but uncapped.
3. **Low absolute revenue per user (₹149/mo ≈ $1.7)** means the whole model lives or dies on **conversion rate and volume**, not on cost control.

So: yes, you'll make good margin *per paying user*. Whether the business works depends on how many free users convert — and right now your free tier is too generous to push them.

---

## What you have today (read from the code)

- **Free:** 3 scans/day, server-enforced (`FREE_DAILY_SCAN_LIMIT = 3`).
- **Pro benefits shown:** Unlimited AI scans, deep macro insights, personalized meal plans.
- **Pricing:** ₹149/month, ₹999/year (annual = ~44% off monthly).
- **AI model:** `gemini-2.5-flash`, image resized to 1024px, short prompt, JSON output. A `scan_cache` dedupes identical images (rarely helps — food photos are unique).
- **There's a `trial_end_date` field** in the schema but I didn't see where a trial is granted.

---

## Unit economics

### Cost per scan (the only real variable cost)
- Input ≈ 1,400 tokens (1,290 for a 1024px image + ~110 prompt) × $0.30/M = **$0.00042**
- Output ≈ 120 tokens × $2.50/M = **$0.00030**
- **≈ $0.0007 per scan ≈ ₹0.06** (~16 scans per ₹1)

### Net revenue per plan (after store fee)
Store fee is **15%** in your realistic case (Google Play charges 15% on the first $1M for all devs; Apple's Small Business Program is 15% under $1M; subscriptions drop to 15% after 12 months anyway). Worst case (Apple, year 1, not enrolled) is 30%. RevenueCat is **free until $2,500/mo revenue**, then 1% — ignore it early.

| Plan | Gross | Net @15% | Net @30% |
|---|---|---|---|
| Monthly ₹149 | ₹149 | **₹127** | ₹104 |
| Annual ₹999 | ₹999 | **₹849** (₹71/mo) | ₹699 (₹58/mo) |

### Margin by how much a user scans (monthly plan, 15% fee → ₹127 net)

| User type | Scans/mo | AI cost | Margin |
|---|---|---|---|
| Light (3/day) | 90 | ₹5 | 96% |
| Average (5/day) | 150 | ₹9 | 93% |
| Heavy (10/day) | 300 | ₹18 | 86% |
| Abuser (50/day) | 1,500 | ₹90 | 29% (still positive) |

**On the annual plan the picture is tighter** — net is only ~₹71/mo:

| User type | Scans/mo | AI cost | Margin on annual |
|---|---|---|---|
| Average (5/day) | 150 | ₹9 | 87% |
| Heavy (10/day) | 300 | ₹18 | 75% |
| 20/day | 600 | ₹36 | 49% |
| Abuser (50/day) | 1,500 | ₹90 | **−₹19 → LOSS** |

**Takeaway:** unlimited scans are safe on monthly but a real (if rare) liability on annual. A fair-use cap fixes this with zero impact on genuine users — nobody logs 30 meals a day.

### Where cost quietly leaks
- **Free-tier AI:** 3/day = up to 90 scans/mo per active free user at ₹5/mo, zero revenue. Small in rupees, but it scales linearly with free users who mostly never convert.
- **Image storage (the sneakier one):** you keep every photo in Supabase Storage (~150 KB each). An active user adds ~22 MB/mo; 10k active users ≈ 225 GB/mo *and it accumulates*. You already extract and store the nutrition data, so the raw image has little long-term value.
- **Fixed infra** (Railway + Supabase): ~$25–50/mo, amortized to ~nothing per user at any real scale. Break-even is ~30–50 Pro subs.

---

## The plan (prioritized)

### 1. Redesign the free tier so it doesn't fully satisfy the job — *highest leverage*
3 scans/day literally covers 3 meals. Options (pick one):
- Drop free to **1–2 scans/day**, **or**
- Keep 3/day but **gate depth behind Pro** — history beyond 7 days, weekly/trend insights, meal plans, macro breakdowns — so the free user *sees* value they can't fully use. Position Pro as "your data + coaching," not just "more scans."
This is the single biggest driver of conversion, which is what actually determines whether you make money.

### 2. Add a "fair-use" cap on Pro (e.g. 30 scans/day)
Well above any real user's need, but it removes the annual-plan loss case and blocks resale/abuse of your API. Show it as "unlimited (fair use)."

### 3. Add a 7-day free trial with an intro offer
RevenueCat supports free trials / intro pricing natively. Trials typically lift conversion 2–4×. Watch trial-abuse (tie to store account, which RevenueCat already does).

### 4. Revisit the annual discount
44% off is steep (industry norm ~30–40%). Either keep ₹999 as a strong acquisition hook, or test **₹1,199/yr (~33% off)** to capture more from committed users. Annual is still worth pushing hard: cash upfront + far lower churn.

### 5. Consider a consumable "scan pack" for free users
A one-time pack (e.g. ₹49 for 50 scans) monetizes people who exceed the free limit occasionally but won't commit to a subscription. Low friction, pure margin.

### 6. Cut storage cost with a lifecycle policy
Auto-delete food images after 30–90 days (the nutrition record already lives in `food_logs`). This caps your biggest growing cost and is also good for privacy/compliance.

### 7. Don't bother optimizing AI cost yet
At ₹0.06/scan it's a rounding error. Levers exist if you 100× (drop images to 768px → ~5× cheaper input; or `gemini-2.5-flash-lite`), but they trade accuracy for pennies. Accuracy drives retention — keep the better model for now.

### Metrics to run the business by
- **Free→Pro conversion** (target 2–5%) — your #1 number.
- **Monthly churn** (target <8–10%; annual much lower).
- **LTV** = net ARPU ÷ churn. At ₹127 net & 10% churn ≈ **₹1,270 LTV/user**. Keep **CAC < LTV/3** (~₹420).
- **Scans per Pro user** (watch the top 1% — your whales/abusers).
- **Blended gross margin** across free + paid.

---

## Verdict
Per-user margin: **strong (85–95%)** — the AI is too cheap to hurt you. The business risk is entirely on the **demand side**: a free tier that satisfies the core need, low ARPU that demands volume, and India's typically low subscription conversion. Fix the free-tier design and add a trial, and the healthy unit economics you already have will actually get a chance to compound.

---

## Assumptions & sources
- FX ≈ ₹86/$1 (2026). Store fee 15% base / 30% worst case. RevenueCat free < $2,500 MTR, then 1%.
- Gemini 2.5 Flash: $0.30/M input, $2.50/M output; 1024px image = 1,290 tokens.
- Usage tiers are modeled estimates, not measured — replace with your real analytics once live.

Sources: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini 2.5 Flash pricing overview](https://www.morphllm.com/gemini-api-pricing), [RevenueCat pricing](https://www.revenuecat.com/pricing)
