# CalVue — Growth plan tracker

What makes CalVue stand out from the other AI calorie counters on Google Play,
and where each item stands. Update the status column as work lands; the commit
column is the proof.

Status key: `todo` · `in progress` · `done` · `blocked` · `skipped`

| # | Feature | Why it differentiates | Status | Commit |
|---|---------|-----------------------|--------|--------|
| 1 | **Health score as the headline**: compare up to three scanned products side by side, and a "Better swap" that names a higher-scoring product from the barcode cache | Nobody else explains *why* a packaged food is bad, or offers a swap | in progress | |
| 2 | **Accuracy you can prove**: "Was this right?" on every scan result, stored and aggregated; portion memory that pre-fills your usual portion for a dish you have logged before | Rivals claim accuracy, none show it; memory makes the second scan faster than the first | todo | |
| 3 | **Own under-served cuisines**: calibration tables and anchors for Middle Eastern, Filipino and Nigerian home cooking, alongside the existing South Asian set | Big diaspora audiences the large apps ignore | todo | |
| 4 | **Shareable weekly review card**: one plain card (calories vs target, protein hit rate, one thing to fix) exported as an image | Screenshots are how a calorie app gets installed by a friend | todo | |
| 5 | **Log in under five seconds**: repeat yesterday's meal in one tap; camera shortcut from the launcher | Speed is the retention driver | todo | |
| 6 | **Privacy you can read**: a "What we keep and for how long" screen in the app and on the site | Conversion factor for a health app, especially EU/UK | todo | |
| 7 | **Health Connect sync**: write calories and water, read steps and weight | Table stakes on Android; store filter "works with Health Connect" | blocked: needs a new dependency (`react-native-health-connect`), awaiting approval | |
| 8 | **Pricing that reads differently**: lead the listing with "Free forever for two meals a day"; consider a lifetime tier | Being the non-subscription option in a sea of weekly trials | todo | |

## Deliberately not doing

Streaks, badges, AI meal plans, "chat with your nutritionist" bots. Every
competitor has them and they do not move retention.

## Log

- 2026-10-12 — Plan created. Order of work: 1, 2, 5, 4, 3, 6, 8; 7 when approved.
