# CalSnap — Design Progress Tracker

This file tracks the Stitch wireframe → React Native implementation status.
Update this file after completing each task.

---

## UI Redesign — Stitch Dark Tech Theme

### Theme & Foundation
- [x] `mobile/src/theme/colors.ts` — Light theme updated to Stitch Calm palette; Dark theme updated to Stitch dark tokens
- [x] `mobile/src/store/themeStore.ts` — Default mode set to `'dark'`

### Screens
- [x] `mobile/src/screens/Auth/AuthScreen.tsx` — Full dark/cinematic redesign: hero image, glass auth card, stacked feature cards, CALSNAP brand, Google sign-in only
- [x] `mobile/src/screens/Dashboard/DashboardScreen.tsx` — Full dark tech redesign: CALSNAP header, CalorieRing glass card, Macro Targets card, Nutri-Insight card, Today's Log section, removed DateSelector + WeeklyChart
- [x] `mobile/src/screens/History/HistoryScreen.tsx` — Weekly Insight card added, stat cards themed
- [x] `mobile/src/screens/Scan/ScanScreen.tsx` — Color tokens updated to `#85d3da` / `#01696f`
- [x] `mobile/src/screens/Scan/ScanResultScreen.tsx` — GDA horizontal rows, confidence % badge (top-right), "Edit Details" button

### Components
- [x] `mobile/src/components/CalorieRing.tsx` — Center shows "Remaining" label + cyan value + "kcal"; stats row shows Consumed | Target below ring
- [x] `mobile/src/components/MacroBar.tsx` — Taller bars (12px), colored current value / muted goal value, dark track `rgba(255,255,255,0.05)`
- [x] `mobile/src/components/MealSection.tsx` — Glass card, meal icon in tinted square, time + kcal subtitle, P·C·F macro line

### Remaining
- [ ] `mobile/src/screens/History/HistoryScreen.tsx` — Full dark tech redesign (provide Stitch HTML)
- [x] `mobile/src/screens/Profile/ProfileScreen.tsx` — Full dark tech redesign: gradient avatar ring, Active Goals grid (Weight + Protein), Metric HUD (Water/Steps/Sleep), Subscription CTA, Settings list
- [ ] `mobile/src/navigation/MainTabNavigator.tsx` — Dark tab bar styling
- [ ] `mobile/src/screens/Onboarding/*` — Dark tech styling for all 5 onboarding steps
- [x] `mobile/src/screens/Paywall/PaywallModal.tsx` — Full dark tech redesign: full-screen modal, hero icon, benefits glass card, vertical plan cards (Monthly/Annual with Best Value badge), Razorpay payment methods row, Secure Checkout CTA button

---

## Health & Notifications Features
- [x] `mobile/src/store/healthStore.ts` — Water (glasses, resets daily), sleep (manual), steps (live pedometer, not persisted)
- [x] `mobile/src/hooks/useStepCounter.ts` — Pedometer via expo-sensors; reads today's steps from midnight, live subscription while foregrounded
- [x] `mobile/src/services/notifications.ts` — expo-notifications service: requestPermission, scheduleMealReminder, cancelMealReminder (DAILY trigger type)
- [x] `mobile/src/store/notificationStore.ts` — Persisted store: per-meal enable/disable toggle + time (hour/minute); auto-schedules when toggled on
- [x] `mobile/src/components/NotificationSettingsModal.tsx` — Full-screen modal: 4 meal cards each with Switch + up/down time picker (15-min steps)
- [x] `mobile/src/screens/Profile/ProfileScreen.tsx` — HUD now shows live water (+/- glass buttons), live step count, sleep; Notifications row opens modal
- [x] `mobile/src/utils/nutrition.ts` — Fixed getMealTypeFromTime: 5-11=breakfast, 11-15=lunch, 18-23=dinner, else snack
- [x] `mobile/app.config.js` — Added ACTIVITY_RECOGNITION, RECEIVE_BOOT_COMPLETED, SCHEDULE_EXACT_ALARM permissions + expo-notifications/expo-sensors plugins


- [ ] Verify `/api/analyze-food` enforces `scan_count` server-side
- [ ] Razorpay webhook signature verification
- [ ] Admin panel protected routes

---

_Last updated: Dashboard + components dark tech redesign complete_
