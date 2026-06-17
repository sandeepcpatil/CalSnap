// ─── CalSnap Shared Types ────────────────────────────────────────────────────
// Single source of truth for types used by both Express backend and React Native app.
//
// Backend import:  import type { ... } from '@shared/types'
// Mobile import:   import type { ... } from '@shared/types'
//
// All imports MUST use `import type` — these are erased at compile time,
// so no runtime module resolution is needed.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'monthly' | 'annual';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export interface ActivePlan {
  plan: SubscriptionTier;
  status: SubscriptionStatus;
  ends_at: string;
  razorpay_subscription_id: string;
}

export interface SubscriptionStatusResponse {
  isSubscribed: boolean;
  subscriptionEndDate: string | null;
  scanCount: number;
  freeScanLimit: number;
  activePlan: ActivePlan | null;
}

export interface CreateOrderRequest {
  plan: 'monthly' | 'annual';
}

export interface CreateOrderResponse {
  subscriptionId: string;
  razorpayKeyId: string;
  plan: 'monthly' | 'annual';
  amount: number;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type GenderType = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: GenderType | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: GoalType | null;
  target_calories: number | null;
  // Subscription
  subscription_tier: SubscriptionTier;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  // Usage tracking
  scan_count: number;
  daily_scan_count: number;
  daily_scan_reset_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Food / Nutrition ────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Per-serving calorie and macro breakdown — the core AI output */
export interface CalorieBreakdown {
  food_name: string;
  /** Total estimated kilocalories */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: ConfidenceLevel;
  /** Brief note about portion size assumptions or recognition caveats */
  notes: string;
}

export interface FoodScanRequest {
  /** Supabase storage URL for the uploaded image */
  imageUrl: string;
}

export interface FoodScanResult {
  result: CalorieBreakdown;
  /** true if the result was served from the image hash cache */
  cached: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface ScanHistoryItem {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  image_url: string | null;
  logged_at: string;
  meal_type: MealType;
  notes: string | null;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

/** Discriminated union — always check `success` before accessing `data` or `error` */
export type ApiResponse<T> =
  | { success: true;  data: T;      error?: never }
  | { success: false; data?: never; error: string };

// ─── Scan Limit Error ────────────────────────────────────────────────────────

export interface ScanLimitError {
  error: 'scan_limit_reached';
  message: string;
  scans_used: number;
  scans_limit: number;
  resets_at: string;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  totalProSubscribers: number;
  monthlyRevenuePaise: number;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  scan_count: number;
  is_subscribed: boolean;
  subscription_end_date: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number | null;
  page: number;
  limit: number;
}

export interface AdminLogsResponse {
  logs: ScanHistoryItem[];
  total: number | null;
  page: number;
  limit: number;
}
