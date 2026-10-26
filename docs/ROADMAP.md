# CalVue — Roadmap

Positioning, pricing model, the growth-plan tracker, the product backlog and
the things we deliberately will not build. Update the status columns as work
lands; the commit column is the proof.

Status key: `todo` · `in progress` · `done` · `blocked` · `skipped`

---

## Positioning

> For the Indian professional who knows MyFitnessPal is useless for their diet
> but won't pay ₹3,000/month for HealthifyMe, CalVue is the AI calorie tracker
> that costs less than one Swiggy delivery per month and actually knows the
> difference between a masala dosa and a plain dosa.

Store lead: **"Free forever for two meals a day."** Be the non-subscription
option in a sea of weekly trials.

---

## Pricing model

| Tier | Scans | Price | Why |
|---|---|---|---|
| Trial, first 7 days | 20/day | free, no card | Feels like Pro; trials lift conversion 2–4× |
| Free | 2/day | free | 3/day covered breakfast, lunch and dinner, so nobody needed to pay |
| Pro | 20/day fair use | ₹199/mo · ₹1,299/yr | Cap removes the loss case on heavy annual users |

**Unit economics (estimates, Oct 2026).** A Gemini 2.5 Flash scan costs about
₹0.06. After a 15% store fee the monthly plan nets about ₹169 and the annual
about ₹92/month, so per-user margin is 85–95% even for a heavy user. The
business risk is demand-side, not cost: free→Pro conversion (target 2–5%),
monthly churn (target under 8–10%), and keeping CAC under a third of LTV.
Image storage is the only cost that accumulates, hence the 90-day purge.
Do not spend time optimising AI cost; accuracy drives retention.

Ideas not yet taken: a one-time scan pack (e.g. ₹49 for 50 scans) for free
users who occasionally exceed the limit; a lifetime tier; a ₹149 vs ₹199
price experiment once there is traffic.

---

## Growth plan tracker

What makes CalVue stand out from the other AI calorie counters on Google Play.

| # | Feature | Why it differentiates | Status | Commit |
|---|---------|-----------------------|--------|--------|
| 1 | **Health score as the headline**: compare up to three scanned products side by side, and a "Better swap" that names a higher-scoring product from the barcode cache | Nobody else explains *why* a packaged food is bad, or offers a swap | done | `bcafcbfb` |
| 2 | **Accuracy you can prove**: "Was this right?" on every scan result, stored and aggregated; portion memory that pre-fills your usual portion for a dish you have logged before | Rivals claim accuracy, none show it; memory makes the second scan faster than the first | done | `6a10c8d5` |
| 3 | **Own under-served cuisines**: calibration tables and anchors for Middle Eastern, Filipino and Nigerian home cooking, alongside the existing South Asian set | Big diaspora audiences the large apps ignore | done | `26f6b245` |
| 4 | **Shareable weekly review card**: one plain card (calories vs target, protein hit rate, one thing to fix), shared as text; image export waits on `react-native-view-shot` | Screenshots are how a calorie app gets installed by a friend | done (text share) | `da43ef17` |
| 5 | **Log in under five seconds**: repeat yesterday's meal in one tap; camera shortcut from the launcher | Speed is the retention driver | done | `aaec2214` |
| 6 | **Privacy you can read**: a "What we keep and for how long" screen in the app and on the site | Conversion factor for a health app, especially EU/UK | done | `40def31c` |
| 7 | **Health Connect sync**: write calories and water, read steps and weight | Table stakes on Android; store filter "works with Health Connect" | blocked: needs a new dependency (`react-native-health-connect`), awaiting approval | |
| 8 | **Pricing that reads differently**: lead the listing with "Free forever for two meals a day"; consider a lifetime tier | Being the non-subscription option in a sea of weekly trials | done | `40def31c` |

Pending dependency approvals: `react-native-view-shot` (image export for #4)
and `react-native-health-connect` (#7).

---

## Product backlog

From a competitive analysis against HealthifyMe, MyFitnessPal, Cal AI and
seven others, prioritised for India. Status was set from a code grep on
2026-10-26; confirm before relying on it.

### P1 — must build

| # | Feature | Why | Status |
|---|---|---|---|
| P1-1 | **Katori / roti portion units** on the scan result, mapped to grams, preferred unit remembered per user | Indians eat by katori, roti, piece, glass, not grams | done (`PortionSheet`, `AddItemSheet`) |
| P1-2 | **Thali mode**: one photo returns every item on the plate as an editable list, saved in one tap | A thali has 8–12 items; every other app scans them one by one | done (`ScanItemsEditor`) |
| P1-3 | **Weekly flex view**: weekly balance beside the daily view, two flex days a week, streak computed on the weekly average | Daily streaks make 80% of users quit after one missed day | done (weekly review / recap) |
| P1-4 | **Diet identity**: vegetarian / eggetarian / non-veg / vegan / Jain chosen in onboarding, passed to the model so a Jain user never sees onion or garlic | Trust and personalisation | todo |
| P1-5 | **Indian quick-add database**, top 200 foods with portion-aware entries and regional tags, bundled offline | Staples are eaten daily and should not need a photo | partial (`AddItemSheet`); curated list not done |

### P2 — should build

| # | Feature | Status |
|---|---|---|
| P2-1 | **Chai quick-add**: milk level, sugar spoons, size → calories; remembers preferences | todo |
| P2-2 | **Recipe builder with a cooking-fat step** (ghee / oil / butter, teaspoons) and a servings calculator | todo |
| P2-3 | **Meal-timing awareness**: reminders at the user's real meal times, IF eating-window mode | partial (per-meal reminder times exist) |
| P2-4 | **Restaurant chain presets** for the top 15 Indian chains | todo |
| P2-5 | **Scan reveal polish**: numbers count up, staged fade-in, haptic pulse, Instagram-ready share | todo |
| P2-6 | **Onboarding redesign**: first scan inside 60 seconds and before account creation, diet identity step, paywall moved to day 3 | todo |

### P3 — nice to have

| # | Feature | Status |
|---|---|---|
| P3-1 | Barcode scanner for packaged foods via Open Food Facts | done (`backend/src/routes/barcode.ts`, migration 004) |
| P3-2 | Festival / occasion mode with relaxed goals and no streak penalty | todo |
| P3-3 | Micronutrient lite: iron, calcium, B12 as traffic lights | partial (migration 006 stores micros) |
| P3-4 | Share meal card for Instagram / WhatsApp | todo (weekly card ships as text, see tracker #4) |
| P3-5 | Health Connect / Apple Health sync | blocked, see tracker #7 |

---

## Deliberately not building

Every competitor has these. They add complexity without moving retention for
Indian users.

| Feature | Why skip |
|---|---|
| Streaks, badges, gamification | Daily streaks punish one missed day; weekly balance instead |
| AI meal plans / meal plan library | Nobody follows a prescribed plan after week one |
| "Chat with your nutritionist" bots as a headline feature | Every competitor has one; it does not move retention |
| Step counter / "eat back calories" | Wearables are rare in India and the model is nutritionally wrong |
| Body measurements (waist, hips) | High friction, low frequency, feels clinical |
| Social feed / public food posts | Food-shaming risk, privacy concerns, ~2% engagement |
| Net calories (in minus out) | Exercise data is inaccurate and creates an "earned a samosa" mental model |
| Vitamin / supplement logging | Cronometer's territory |

---

## Design system

The dark "tech" look is intentional: Apple Fitness / Whoop / Oura rather than a
colourful consumer app. All tokens live in `mobile/src/theme/` (colours,
typography, spacing, radius, shadows); the earlier audit that found eleven
screens with their own hardcoded palettes has been resolved. Keep it that way:
no hardcoded colour objects in screens, minimum 44×44 touch targets,
WCAG AA contrast for body text.

---

## Log

- 2026-06-23 — Product backlog written from the competitive analysis.
- 2026-07-10 — Pre-launch audit. Payments moved from Razorpay to RevenueCat; AI moved from OpenAI to Gemini 2.5 Flash.
- 2026-10-12 — Growth plan created. Order of work: 1, 2, 5, 4, 3, 6, 8; 7 when approved. Features 1, 2, 3, 4, 5, 6 and 8 landed, one commit each. Type-checks, site build and unit tests pass on the combined tree.
- 2026-10-26 — Docs consolidated: the old TASKS, PROGRESS, GROWTH_PLAN, pricing analysis, pricing rollout, pre-launch report, setup guides and design-overhaul prompt merged into this file, SETUP.md and RELEASE_CHECKLIST.md. The original build spec lives in git history.
