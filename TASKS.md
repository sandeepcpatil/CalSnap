Build a full-stack React Native calorie tracking app (iOS + Android) called "CalSnap" with the following complete specification. Use Expo (managed workflow) for React Native, Node.js + Express for the backend API, and PostgreSQL (via Supabase) as the database — Supabase handles auth, real-time, storage, and scales to millions of users without self-managing infra.

---

## TECH STACK

**Mobile:** React Native (Expo SDK 51+), React Navigation v6, Zustand for state, React Native Paper for UI
**Backend:** Node.js + Express (REST API), deployed on Railway or Render
**Database:** Supabase (PostgreSQL) — use their hosted Postgres, Auth, and Storage
**AI:** OpenAI GPT-4o Vision API (`gpt-4o` model) for food detection from photos
**Payments:** Razorpay (supports ₹150/month Indian pricing natively)
**Auth:** Google OAuth via Supabase Auth (handles Google Sign-In on both iOS + Android)
**Admin Panel:** Separate React web app (Vite + React) or a route in the Express server serving an HTML dashboard

---

## DATABASE SCHEMA (Supabase / PostgreSQL)

Create these tables:

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  weight_kg DECIMAL,
  height_cm DECIMAL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  body_goal TEXT CHECK (body_goal IN ('lose_weight', 'maintain', 'gain_muscle')),
  daily_calorie_goal INTEGER,
  daily_protein_goal INTEGER,
  scan_count INTEGER DEFAULT 0,
  is_subscribed BOOLEAN DEFAULT false,
  subscription_end_date TIMESTAMPTZ,
  razorpay_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food scan logs
CREATE TABLE food_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT,
  food_name TEXT,
  calories INTEGER,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  fiber_g DECIMAL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  raw_ai_response JSONB,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('monthly', 'annual')),
  status TEXT CHECK (status IN ('active', 'cancelled', 'expired')),
  razorpay_subscription_id TEXT,
  amount_paise INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin table (for admin panel access)
CREATE TABLE admin_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL
);
```

Enable Row Level Security (RLS) on all tables. Users can only read/write their own rows.

---

## FEATURE 1: GOOGLE AUTHENTICATION

- Use Supabase Auth with Google provider
- On the mobile app, use `expo-auth-session` with Supabase's OAuth flow
- After sign-in, check if a `profiles` row exists. If not, create one and show the onboarding flow
- Store the Supabase session token in Zustand + SecureStore

---

## FEATURE 2: ONBOARDING (show once after first Google sign-in)

Multi-step onboarding screens:
1. **Welcome** — name, age, gender
2. **Body Stats** — weight (kg), height (cm)
3. **Activity Level** — sedentary / lightly active / moderately active / very active
4. **Goal** — Lose Weight / Maintain Weight / Build Muscle
5. **Auto-calculate daily calorie goal** using Mifflin-St Jeor formula + activity multiplier + goal adjustment:
   - BMR (male) = 10×weight + 6.25×height - 5×age + 5
   - BMR (female) = 10×weight + 6.25×height - 5×age - 161
   - Multiply by activity factor (1.2 / 1.375 / 1.55 / 1.725)
   - Goal adjustment: lose = BMR × factor - 500 kcal; maintain = BMR × factor; gain = BMR × factor + 300 kcal
   - Protein goal: 1.6g per kg of body weight
6. Save everything to `profiles` table. Show a summary card with their calorie + protein targets.

---

## FEATURE 3: PHOTO SCAN + AI CALORIE DETECTION

Flow:
1. User taps "Scan Food" button (camera icon, prominent in the center of the bottom tab bar)
2. **Check scan gate:** If `scan_count >= 5` AND `is_subscribed = false`, show a paywall modal (see Feature 6). Block the scan.
3. Otherwise, open camera using `expo-camera` or `expo-image-picker`
4. After photo is taken:
   - Upload image to Supabase Storage (`food-images` bucket, private)
   - Get a signed URL
   - Call your backend `/api/analyze-food` endpoint with the signed URL
5. Backend calls OpenAI GPT-4o Vision API with this system prompt:


You are a professional nutritionist AI. Analyze the food in this image and return ONLY a valid JSON object with no markdown, no explanation:
{
"food_name": "string (descriptive name of the food)",
"calories": number (total estimated kcal),
"protein_g": number,
"carbs_g": number,
"fat_g": number,
"fiber_g": number,
"confidence": "high" | "medium" | "low",
"notes": "string (brief note about portion size assumptions)"
}
If you cannot identify the food, return: { "error": "Could not identify food" }


6. Display the results on a beautiful result card:
   - Large food name
   - Calorie count (prominent)
   - Macro breakdown: protein, carbs, fat, fiber as horizontal pill bars
   - Confidence badge
   - AI notes
   - Meal type selector (Breakfast / Lunch / Dinner / Snack) — auto-detect based on time of day
   - **Save** button and **Retake** button

7. On Save:
   - Insert row into `food_logs`
   - Increment `profiles.scan_count` by 1
   - Navigate to today's dashboard

---

## FEATURE 4: DASHBOARD (Home Tab)

Show for today's date:

**Top section:**
- Greeting with user's name + avatar
- Date selector (swipe left/right to change day)

**Calorie Ring (main visual):**
- Circular progress ring showing calories consumed vs. daily goal
- Center: `1,240 / 2,000 kcal` with remaining kcal below

**Macro Progress Bars:**
- Protein: X / Yg (green)
- Carbs: X / Yg (orange)  
- Fat: X / Yg (yellow)

**Meal Sections:**
- Collapsible sections for Breakfast, Lunch, Dinner, Snack
- Each food log entry shown as a card: food name, kcal, macros, small thumbnail

**7-Day Trend Chart:**
- Line chart of daily calories for the past 7 days vs. goal line
- Use `react-native-chart-kit` or `victory-native`

---

## FEATURE 5: HISTORY TAB

- Calendar view (monthly) — dots on days with logs, color-coded (green = under goal, red = over goal)
- Tap a day to see that day's logs
- Summary stats: average calories this week, best streak, total scans

---

## FEATURE 6: SUBSCRIPTION + PAYWALL

**Paywall Modal** (shown when free scans are exhausted):
- Title: "You've used your 5 free scans"
- Subtitle: "Upgrade to CalSnap Pro for unlimited scans"
- **Two plan cards:**

| | Monthly | Annual |
|---|---|---|
| Price | ₹150/month | ₹1,200/year (₹100/mo) |
| Savings | — | Save ₹600/year |
| Badge | — | 🔥 Best Value |

- Both plans include: Unlimited scans, Full history, Trend charts, Priority AI analysis
- **"Continue with [Plan]"** button — launches Razorpay checkout

**Razorpay Integration:**
- Backend: Create a Razorpay subscription plan for monthly (₹150) and annual (₹1,200)
- Use `react-native-razorpay` package on mobile
- On successful payment:
  - Backend webhook from Razorpay updates `profiles.is_subscribed = true` and `subscription_end_date`
  - Insert row in `subscriptions` table
- On subscription cancel/expire: set `is_subscribed = false`

**Profile Tab → "Manage Subscription"** shows current plan status, next billing date, cancel option.

---

## FEATURE 7: PROFILE TAB

- User avatar (from Google), name, email
- Edit body stats (weight, height — update to recalculate goals)
- Change goal (lose/maintain/gain)
- Subscription status badge
- Scan count remaining (e.g., "3 / 5 free scans used") or "Pro Member ✓"
- App version, Privacy Policy, Terms, Sign Out

---

## FEATURE 8: ADMIN PANEL (Web)

Build a separate `/admin` React web page (can be served by Express at `/admin`) protected by a simple login that checks the `admin_users` table.

Show these real-time stats (query Supabase directly):

**KPI Cards (top row):**
- Total Users
- Active Today (users with a food_log in last 24h)
- Active This Week (food_log in last 7 days)
- Active This Month
- Total Pro Subscribers
- Monthly Revenue (count of active monthly subs × ₹150 + annual subs × ₹1200/12)

**Charts:**
- Daily new user signups (last 30 days) — bar chart
- Daily scans (last 30 days) — line chart
- Subscription conversion rate (free → paid) — number + trend

**Users Table:**
- Paginated table: Name, Email, Joined Date, Scan Count, Plan (Free/Pro), Last Active
- Search by email
- Click user → see their food log history

Use Chart.js for charts. Style with Tailwind CSS. Dark mode support.

---

## APP NAVIGATION STRUCTURE

Bottom Tab Navigator:
1. 🏠 Home (Dashboard)
2. 📷 Scan (center, larger button — opens camera directly)
3. 📅 History
4. 👤 Profile

Stack navigators within each tab as needed.

---

## ENVIRONMENT VARIABLES

```env
# Backend .env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
ADMIN_SECRET=

# Mobile app .env (via expo-constants or app.config.js)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_BACKEND_URL=
EXPO_PUBLIC_RAZORPAY_KEY_ID=
```

---

## PROJECT STRUCTURE
calsnap/
├── mobile/ # Expo React Native app
│ ├── app.config.js
│ ├── App.tsx
│ ├── src/
│ │ ├── screens/
│ │ │ ├── Auth/ # Google sign-in screen
│ │ │ ├── Onboarding/ # 5-step onboarding
│ │ │ ├── Dashboard/ # Home tab
│ │ │ ├── Scan/ # Camera + result
│ │ │ ├── History/ # Calendar + logs
│ │ │ ├── Profile/ # Profile + subscription
│ │ │ └── Paywall/ # Subscription modal
│ │ ├── navigation/ # Stack + Tab navigators
│ │ ├── store/ # Zustand stores
│ │ ├── services/ # Supabase client, API calls
│ │ ├── components/ # Reusable UI components
│ │ └── utils/ # BMR calc, formatters
│ └── package.json
│
├── backend/ # Node.js + Express API
│ ├── src/
│ │ ├── routes/
│ │ │ ├── analyze.js # POST /api/analyze-food
│ │ │ ├── subscription.js # Razorpay webhooks + create order
│ │ │ └── admin.js # Admin API endpoints
│ │ ├── middleware/
│ │ │ ├── auth.js # Verify Supabase JWT
│ │ │ └── adminAuth.js # Admin check
│ │ └── index.js
│ └── package.json
│
└── admin/ # React admin panel (Vite)
├── src/
│ ├── pages/
│ │ ├── Dashboard.jsx # Main admin dashboard
│ │ └── UserDetail.jsx # Single user view
│ └── main.jsx
└── package.json


---

## UI DESIGN GUIDELINES

- Use **React Native Paper** as the component library
- Primary color: `#01696f` (teal) — matches the app's health/wellness tone
- Dark and light mode support via React Native Paper's theme system
- The Scan tab button should be a raised circular FAB in the center of the tab bar — larger than other tabs
- Calorie ring: use `react-native-svg` with a custom circular progress component
- All screens should have smooth transitions using React Navigation's default animations
- Use `expo-haptics` for tactile feedback on scan button press, save actions, and subscription success
- Loading states: use skeleton screens (react-native-skeleton-placeholder) — never spinners on content areas
- Empty states: illustrated with a simple SVG icon + warm message + CTA

---

## IMPORTANT IMPLEMENTATION NOTES

1. **Supabase RLS:** Enable Row Level Security on all tables. Users can only access their own data. Service role key (backend only) bypasses RLS for admin operations.

2. **OpenAI cost control:** Cache AI results by image hash. If the same image is uploaded twice, return the cached result. Log all OpenAI calls with tokens used.

3. **Razorpay webhooks:** Always verify the webhook signature using `crypto.createHmac`. Never trust unverified webhooks for updating subscription status.

4. **Free tier gate:** Check scan count server-side in `/api/analyze-food` — never trust client-side checks only.

5. **Image storage:** Store images in Supabase Storage with a 90-day retention policy. Generate signed URLs (1-hour expiry) for display.

6. **Offline support:** Cache today's food logs locally using AsyncStorage so the dashboard loads instantly.

7. **App Store / Play Store:** Configure `app.config.js` with proper bundle ID (`com.yourname.calsnap`), permissions for camera and photo library, and Google Sign-In configuration.

Build the complete application with all features. Start with the database schema and backend API, then the mobile app screens, and finally the admin panel.

---

# PRODUCT ROADMAP
*Based on competitive analysis vs HealthifyMe, MyFitnessPal, Cal AI and 7 others. Prioritized for Indian market.*

---

## ? SHIPPED (Already Built)

- [x] Google OAuth sign-in
- [x] Multi-step onboarding (name, body stats, activity, goal, calorie target)
- [x] AI photo scan ? calorie + macro breakdown (Gemini 2.5 Flash)
- [x] Optional food description hint for AI (solves hidden ingredient problem)
- [x] Animated analyzing overlay during scan (cycling steps + pulsing ring)
- [x] Dashboard with calorie ring, macro bars, meal sections
- [x] Food log history screen
- [x] Free tier scan gate (3 scans/day) enforced server-side
- [x] Paywall modal with monthly (?149) and annual (?999) plans
- [x] Razorpay subscription integration
- [x] Supabase storage for food photos
- [x] Admin panel with Google OAuth (Vercel deployed)
- [x] Backend on Railway (Express + TypeScript)
- [x] GitHub Actions Android build with auto-incrementing versionCode
- [x] Scan result caching to avoid duplicate AI calls

---

## P1 � MUST BUILD (High impact, directly drives retention)

### P1-1: Katori / Roti Portion Unit System
**Why:** Every competitor uses grams. Indians cook and eat by katori, roti, piece, glass. This is the #1 logging friction.
**What to build:**
- Add portion unit selector on ScanResultScreen: grams / katori / piece / bowl / glass / roti / cup
- Map units to gram equivalents (1 katori = 150g, 1 medium roti = 40g, 1 glass = 200ml)
- Store preferred unit per user in profiles table
- Show results in user's preferred unit
- Onboarding step: photo of their actual katori to calibrate size (small/medium/large)
**Files:** mobile/src/screens/Scan/ScanResultScreen.tsx, database/schema.sql, ackend/src/routes/analyze.ts
**Effort:** Medium (3�4 days)
**Retention impact:** Very High

---

### P1-2: Thali Mode � Scan Once, Log Everything
**Why:** A thali has 8�12 items. Every app requires individual scanning. This is uniquely Indian and uniquely unsolved.
**What to build:**
- "Thali mode" toggle on ScanScreen (icon: thali plate)
- Single photo ? AI identifies ALL visible items as a list
- Shows editable breakdown: each item with name + calories, user can remove or adjust
- One "Save all" tap logs everything
- Update Gemini prompt to return array of items when thali mode is active
**Gemini prompt addition:** "If the image contains multiple distinct food items on a plate/thali, return an array of items instead of a single object: [{ food_name, calories, ... }, ...]"
**Files:** mobile/src/screens/Scan/ScanScreen.tsx, mobile/src/screens/Scan/ScanResultScreen.tsx, ackend/src/routes/analyze.ts
**Effort:** Medium (3�5 days)
**Retention impact:** High

---

### P1-3: Forgiveness Mode � Weekly Flex Days
**Why:** Daily streak systems cause 80% of users to quit after missing one day. Weekly balance is nutritionally sound and psychologically forgiving.
**What to build:**
- Show weekly calorie view alongside daily view on Dashboard
- 2 "Flex Days" per week � going up to 20% over daily goal does not count as "over"
- Streak logic: calculated on weekly average, not daily compliance
- Dashboard copy change: "You're 340 kcal under this week � Sunday biryani is earned ??"
- Settings: let user toggle between daily and weekly view as default
**Files:** mobile/src/screens/Dashboard/DashboardScreen.tsx, mobile/src/store/foodLogStore.ts, mobile/src/utils/nutrition.ts
**Effort:** Low�Medium (2�3 days)
**Retention impact:** Very High

---

### P1-4: Diet Identity System (Vegetarian / Jain / Eggetarian / etc.)
**Why:** Indian food culture requires this. A Jain user must never see onion/garlic dishes. A vegetarian should not see chicken suggestions.
**What to build:**
- Add diet_type field to profiles: egetarian | eggetarian | non_vegetarian | vegan | jain
- Add as step in onboarding (big tap icons, not a dropdown)
- Filter AI suggestions and food database results by diet type
- Pass diet_type in backend request so Gemini can be aware: "User is Jain � do not suggest or include onion, garlic, or meat"
- Show diet badge on profile screen
**Files:** mobile/src/screens/Onboarding/, database/schema.sql, ackend/src/routes/analyze.ts
**Effort:** Low (1�2 days)
**Retention impact:** High (trust + personalization)

---

### P1-5: Indian Food Quick-Add Database (Top 200 items)
**Why:** AI scanning is great but users also eat the same things repeatedly. A quick-add database of the 200 most common Indian foods removes the need to photograph home-cooked staples.
**What to build:**
- Curated list of 200 Indian foods with accurate nutrition (idli, dosa, roti, rice, dal, sabzi, etc.)
- Searchable quick-add on Dashboard (tap "+" ? search ? select ? done in 3 taps)
- Include portion-aware entries: "Roti (1 medium)", "Idli (1 piece)", "Rice (1 katori)"
- Include regional tags: South Indian / North Indian / Bengali / Gujarati
- Store as JSON in app (no network call needed) + sync to backend for logging
**Files:** New file mobile/src/data/indianFoods.ts, mobile/src/screens/Dashboard/DashboardScreen.tsx
**Effort:** Medium (3�4 days data curation + 1 day UI)
**Retention impact:** High

---

## P2 � SHOULD BUILD (Medium effort, meaningful differentiation)

### P2-1: Chai Quick-Add
**Why:** 3 chais/day � 80 calories = 240 invisible calories nobody logs. This is a memorable, shareable feature specific to India.
**What to build:**
- One-tap "Chai" floating button on Dashboard
- Bottom sheet: milk level (little / normal / full) + sugar (0 / 1 / 2 spoons) + size (small / large)
- Calculates calories: base 35 kcal + milk (15/30/45) + sugar (16/32 per spoon)
- Saves as habit � remembers your preferences after first use
- Optional: "Tea" / "Coffee" / "Chai" variants
**Effort:** Low (1 day)
**Retention impact:** Medium (but extremely memorable and shareable)

---

### P2-2: Homemade Recipe Builder with Ghee Awareness
**Why:** "Dal tadka" without tracking the tadka (ghee + spices) misses 80�120 calories. Recipe builders exist in other apps but none ask about cooking fat.
**What to build:**
- Recipe screen: add ingredients from quick-add database or manual entry
- Explicit "Cooking fat" step: ghee / oil / butter / none + quantity in teaspoons
- Save recipe with custom name ("Maa's Rajma") ? becomes one-tap log item
- Servings calculator: made 4 portions, log 1
- Recipes section on Dashboard below meal log
**Files:** New screen mobile/src/screens/Recipes/, database/schema.sql (add recipes table)
**Effort:** Medium (4�5 days)
**Retention impact:** High (family recipes = habitual logging)

---

### P2-3: Meal Timing Awareness
**Why:** Indian working professionals eat late. App reminders at 6pm for dinner are useless. Breakfast reminders at 7am don't account for IF users.
**What to build:**
- Onboarding: "When do you usually eat?" � tap time slots per meal
- Smart notification at user's actual meal times (not generic 8am/12pm/7pm)
- IF mode: hide breakfast slot, show eating window timer on dashboard
- Dashboard auto-selects correct meal type based on current time + user's schedule
**Files:** mobile/src/screens/Onboarding/, mobile/src/screens/Dashboard/DashboardScreen.tsx
**Effort:** Low�Medium (2 days)
**Retention impact:** Medium

---

### P2-4: Weekly Progress View
**Why:** Daily calorie view shows failure when users go over. Weekly view shows the real picture and is more forgiving and accurate nutritionally.
**What to build:**
- Weekly tab on Dashboard (alongside Today)
- 7-bar chart showing daily intake vs goal, colored by under/over/flex
- Weekly totals: avg calories, avg protein, best day, flex days used
- "This week vs last week" comparison card
**Files:** mobile/src/screens/Dashboard/DashboardScreen.tsx, mobile/src/components/WeeklyChart.tsx
**Effort:** Low (1�2 days, WeeklyChart component exists)
**Retention impact:** High

---

### P2-5: Scan Reveal Animation Polish
**Why:** The post-scan result reveal is the signature moment of the app. Currently shows a static result. Making it feel like a reward drives sharing and word of mouth.
**What to build:**
- Numbers count up from 0 over 0.8 seconds when result appears
- Food name fades in first, then calories, then macros in sequence
- Subtle haptic pulse on each number reveal
- Optional: share button that screenshots the result card formatted for Instagram Stories
**Files:** mobile/src/screens/Scan/ScanResultScreen.tsx
**Effort:** Low (1 day)
**Retention impact:** Medium (high virality potential)

---

### P2-6: Restaurant Chain Presets
**Why:** Indian users eat from the same chains repeatedly. Saravana Bhavan, MTR, Haldiram's, McDonald's India, Domino's India, Subway India menus should be one tap.
**What to build:**
- Restaurant tab in quick-add: search by chain name
- Curated menus for top 15 Indian chains with accurate nutrition
- "Ordered from Swiggy/Zomato?" � planned future integration
**Files:** New data file mobile/src/data/restaurants.ts
**Effort:** Medium (3 days data + 1 day UI)
**Retention impact:** Medium

---

### P2-7: Onboarding Redesign (Competitive Differentiation)
**Why:** Current onboarding collects data before showing value. The wow moment is buried. Per competitive analysis, the first scan should happen within 60 seconds.
**What to build:**
- Screen 1: Full-screen hero with thali?calories animation. CTA: "Try it now � no account needed"
- Screen 2: Instant camera ? first scan ? result (before account creation)
- Screen 3: Diet identity (Vegetarian / Eggetarian / Non-veg / Vegan / Jain) � big tap icons
- Screen 4: Meal pattern (3 meals / 4 meals / IF / skip lunch)
- Screen 5: One honest question � "What's your goal?" (not weight-shaming framing)
- Screen 6: The Flex Days promise � "We know you'll miss a day. That's fine."
- Screen 7: Name + optional weight + notification time
- Move paywall to Day 3 (when free scans run out), not onboarding
**Files:** mobile/src/screens/Onboarding/, mobile/src/navigation/OnboardingNavigator.tsx
**Effort:** High (5�7 days full redesign)
**Retention impact:** Very High (30-day retention most sensitive to onboarding)

---

## P3 � NICE TO HAVE (Build after P1+P2 are done)

### P3-1: Barcode Scanner for Packaged Foods
- Scan packaged food barcode ? auto-fill nutrition from Open Food Facts API
- Useful for urban users buying packaged snacks, protein bars, biscuits
- **Effort:** Medium | **Impact:** Medium

### P3-2: Festival / Occasion Mode
- Diwali / Eid / Onam / Christmas presets with common items
- "Festival Day" toggle � relaxed calorie goals, no streak penalty
- **Effort:** Low | **Impact:** Medium (memorable, seasonal)

### P3-3: Micronutrient Awareness (Lite)
- Show iron, calcium, B12 only (most common Indian dietary gaps)
- Simple traffic light (good/low/very low) not a full Cronometer-style breakdown
- Especially relevant for vegetarians (B12, iron) and women (iron, calcium)
- **Effort:** Medium | **Impact:** Medium

### P3-4: Share Meal Card
- Post-save: shareable card with food photo + calories formatted for Instagram / WhatsApp
- Auto-generates: "Just logged my lunch � 620 kcal ?? Tracked with CalSnap"
- **Effort:** Low | **Impact:** Medium (organic growth)

### P3-5: Apple Health / Google Fit Sync
- Export daily calorie + macro data to platform health apps
- Required for credibility with fitness-focused users
- **Effort:** Medium | **Impact:** Medium

---

## ? ANTI-FEATURES � Deliberately NOT building

These are features all competitors have that add complexity without retention value for Indian users:

| Feature | Why skip |
|---|---|
| Step counter / activity tracking | Indians don't use wearables at scale. "Eat back calories" model is nutritionally wrong |
| Water intake tracker | Set up day 1, ignored day 3. Zero retention impact |
| Body measurements (waist, hips) | High friction, low frequency, makes casual users feel like clinical subjects |
| Social feed / public food posts | Food shaming risk, privacy concerns, only 2% of users engage |
| Barcode scanner (V1) | 70% of Indian meals are home-cooked. Solves 30% of meals. P3 only |
| Net calories (in minus out) | Exercise calorie data is inaccurate. Creates "earned a samosa" mental model |
| Meal plan library | Nobody follows prescribed plans after week 1. Marketing feature, not retention feature |
| Vitamin / supplement logging | Cronometer's territory. Your user is not tracking B12 capsules |

---

## POSITIONING STATEMENT (Use this everywhere)

> "For the Indian professional who knows MyFitnessPal is useless for their diet but won't pay ?3,000/month for HealthifyMe, CalSnap is the AI calorie tracker that costs less than one Swiggy delivery per month and actually knows the difference between a masala dosa and a plain dosa."

---
*Last updated: 2026-06-23*
