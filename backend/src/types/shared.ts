// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// ─── Food / Scan ──────────────────────────────────────────────────────────────

export interface CalorieBreakdown {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /**
   * Total estimated weight of the food in grams. Surfaced in the UI so the
   * user can sanity-check the assumption behind the numbers — portion size is
   * the single largest source of error in photo-based estimation.
   */
  portion_g: number;
  /** Human-readable portion, e.g. "1 medium katori" or "2 rotis". */
  portion_desc: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface FoodScanResult {
  result: CalorieBreakdown;
  cached: boolean;
}

export interface ScanLimitError {
  error: 'scan_limit_reached';
  message: string;
  scans_used: number;
  scans_limit: number;
  resets_at: string;
}

/** Returned to Pro/trial users who hit the daily fair-use ceiling (HTTP 429). */
export interface DailyLimitError {
  error: 'daily_limit_reached';
  message: string;
  scans_used: number;
  scans_limit: number;
  resets_at: string;
}

// ─── Label Scan (packaged food) ───────────────────────────────────────────────

/** Nutrition values normalised to per 100 g (or 100 ml for drinks). */
export interface LabelNutrition {
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  sugar_g: number;
  total_fat_g: number;
  sat_fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}

/** Deterministic health assessment computed server-side (never by the AI). */
export interface HealthScoreDetail {
  /** 0–100, higher = healthier. */
  score: number;
  /** Nutri-Score style letter grade. */
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  /** One-line, human-readable reason built from the biggest score drivers. */
  summary: string;
  positives: string[];
  negatives: string[];
}

export interface LabelScanData {
  product_name: string;
  brand: string;
  /** Stated serving size in grams; 0 when not printed on the pack. */
  serving_g: number;
  /** Drinks are scored on stricter Nutri-Score beverage thresholds. */
  is_beverage: boolean;
  per_100g: LabelNutrition;
  ingredients: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  health: HealthScoreDetail;
}

export interface LabelScanResult {
  result: LabelScanData;
  cached: boolean;
}

export interface ScanHistoryItem {
  id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string;
  logged_at: string;
  image_url: string | null;
}

// ─── Subscription (RevenueCat) ──────────────────────────────────────────────────

export interface SubscriptionStatusResponse {
  isSubscribed: boolean;
  subscriptionEndDate: string | null;
  scanCount: number;
  freeScanLimit: number;
  activePlan: {
    plan: 'monthly' | 'annual';
    status: 'active';
    ends_at: string;
  } | null;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

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
