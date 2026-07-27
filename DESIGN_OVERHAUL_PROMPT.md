# Design / Theme Overhaul — Prompt

Paste everything below the line into a fresh session with the project folder attached.

---

You are a senior product designer + React Native engineer. I want you to audit and unify the **entire design system, theme, and colour scheme** of my app, CalSnap, and then implement the improvements.

## What the app is

CalSnap is an Expo / React Native (TypeScript) mobile app for the **Indian market**. Users photograph a meal and AI returns calories + macros; they can also scan a packaged-food nutrition label and get a 0–100 health score. There's a free tier (2 scans/day) and a Pro subscription. The aesthetic today is a **dark, "tech/glassmorphism" look** — dark slate backgrounds, translucent glass cards, cyan/teal accents.

## The core problem (most important)

The project already has a **complete, well-structured theme system** that is being almost entirely ignored:

- `src/theme/colors.ts` — 338 lines, a full `ColorTheme` interface with **light and dark** variants. Tokens cover: `bg`, `surface`, `surfaceOffset`, `textPrimary/Secondary/Muted/Inverse`, `primary` (+Light/Dark/Tint), semantic `success/warning/error/info` (+tints), **macro colours** `protein/carbs/fat/fiber` (+tints), `borderColor`, `dividerColor`, `overlay`, `tabBar*`, `card*`, `scan*`, `nav*`, `statusBar`.
- `src/hooks/useTheme.ts` — returns `{ theme, mode, isDark, toggleTheme, setTheme }`.
- `src/store/themeStore.ts` — persisted light/dark preference.

**But 11 files bypass it completely**, each redeclaring its own hardcoded `const C = { ... }` colour object:

```
components/AlertsModal.tsx          components/EditProfileModal.tsx
components/ExportRangeModal.tsx     components/LegalModal.tsx
components/NotificationSettingsModal.tsx
screens/Auth/AuthScreen.tsx         screens/Dashboard/DashboardScreen.tsx
screens/History/HistoryScreen.tsx   screens/Paywall/PaywallModal.tsx
screens/Profile/ProfileScreen.tsx   screens/Scan/LabelResultScreen.tsx
```

Only these use `useTheme` properly: `CalorieRing`, `MacroBar`, `MacroPieChart`, `MealSection`, `TrialBanner`, `WeeklyChart`, `ThemedText`, `ThemedView`, `ThemeToggle`, `MainTabNavigator`, `DashboardScreen` (partially), `ScanResultScreen`.

**Consequence:** the same colour is defined a dozen times with slight drift, light mode is effectively broken (the hardcoded screens stay dark), and changing the brand colour means editing 11 files. Fixing this is the foundation of the whole task.

The recurring hardcoded palette is:
```
bg #101415 · glass rgba(15,23,42,0.80) · glassBorder rgba(255,255,255,0.08)
primary #85d3da · secondary #bdf4ff · tertiary #c0c1ff · secondaryCont #00e3fd
primaryCont #01696f · onPrimary #00363a
onSurface #e0e3e5 · onSurfaceVar #bec8c9 · outline #889393 · outlineVar #3f4949
error #ffb4ab · good #78d8a8 · medium #ffc46b · bad #ff8a80
```

## Known specific inconsistencies to fix

1. **Brand colour clash in app config** — `mobile/app.config.js` sets the Android `adaptiveIcon.backgroundColor` to **`#ab3500` (orange)** while the entire app is teal/cyan. The `splash.backgroundColor` is **`#f7fafa` (near-white)**, so launching the dark app flashes a white screen. Both should align with the brand.
2. **Light mode is half-built** — `ThemeToggle` and light tokens exist, but hardcoded screens ignore them. Decide deliberately: either finish light mode properly, or remove the toggle and commit to dark-only. Tell me which you recommend and why.
3. **Possibly dead components** — `MacroPieChart.tsx`, `WeeklyChart.tsx`, `ThemedText.tsx`, `ThemedView.tsx` may be unused. Verify before touching.
4. **Typography and spacing have no scale** — font sizes/weights/margins are ad-hoc per file (`fontSize: 13`, `14`, `14.5`, `15`…). There is no `spacing.ts` or `typography.ts`.

## Screens and components in scope

- **Onboarding** (5 steps: Welcome, BodyStats, Activity, Goal, Summary)
- **Auth** — hero image, glass cards, Google sign-in
- **Dashboard (Home)** — greeting, calorie ring, macro donut + macro bars, AI insight card, meal sections
- **Scan** — camera with MEAL/LABEL mode toggle, analysing overlay (scanning beam), permission screen
- **Scan Result** (meal) and **Label Result** (0–100 health-score ring, grade chip, nutrition table)
- **History** — weekly bar chart, range chips, expandable day cards, export
- **Profile** — avatar, goal cards, subscription CTA, settings list
- **Paywall** — plan cards, benefits, CTA
- Shared: `ProGate` (locked-feature overlay), `AlertsModal`, `ExportRangeModal`, `LegalModal`, `NotificationSettingsModal`, `EditProfileModal`, `MainTabNavigator`

## What I want you to deliver

**Phase 1 — Audit (report to me before coding):**
- A design critique of the current system: what works, what's inconsistent, what looks amateur.
- A proposed **refined colour palette** (keep the dark tech identity — I like it — but make it more cohesive, accessible and premium). Show the tokens with hex values and where each is used.
- A **typography scale** and a **spacing scale** (4/8pt based), plus radius and elevation scales.
- Verify **WCAG AA contrast** (≥4.5:1 for body text) for every text-on-background pair, and call out failures in the current palette.

**Phase 2 — Implement (after I approve):**
- Extend `src/theme/` with `typography.ts`, `spacing.ts` (and radius/shadow) alongside `colors.ts`.
- **Migrate all 11 hardcoded files** to consume the theme. No `const C = {...}` colour blocks should remain.
- Fix the app-config brand mismatches (adaptive icon + splash background).
- Make every screen visually consistent: same card treatment, same heading hierarchy, same button styles, same empty states.
- Improve UX where it's clearly weak, not just colours — e.g. empty states, loading states, touch-target sizes (min 44×44), visual hierarchy on Home.

## Hard constraints

- **Do not break the build.** Run `npx tsc --noEmit` in `mobile/` after changes; it must exit 0.
- **Prefer zero new dependencies.** Available already: `react-native-paper`, `react-native-svg`, `expo-linear-gradient`, `@expo/vector-icons` (Ionicons), `react-native-chart-kit`. Adding a native dep forces a full rebuild — avoid unless you justify it to me first.
- Keep React Native `StyleSheet.create` (no Tailwind/NativeWind migration).
- **Don't change business logic** — subscription gating (`ProGate`, `useSubscriptionGate`), the health-score algorithm, API calls, and data models stay exactly as they are. This is presentation-layer only.
- Preserve all existing functionality and copy unless the copy is clearly wrong.
- Work incrementally and show me diffs per screen; don't rewrite everything in one giant commit.

## Style direction

Keep it **dark, clean and premium** — think Apple Fitness / Whoop / Oura rather than a colourful consumer calorie app. Data should feel precise and trustworthy. Avoid clutter, heavy borders, and excessive emoji in UI chrome. The health-score and calorie visualisations are the hero moments — make them feel special.

Start with Phase 1 and report back before writing any code.
