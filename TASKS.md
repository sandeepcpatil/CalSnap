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