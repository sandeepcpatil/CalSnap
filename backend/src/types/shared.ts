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

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface CreateOrderRequest {
  plan: 'monthly' | 'annual';
}

export interface CreateOrderResponse {
  subscriptionId: string;
  razorpayKeyId: string;
  plan: string;
  amount: number;
}

export interface SubscriptionStatusResponse {
  isSubscribed: boolean;
  subscriptionEndDate: string | null;
  scanCount: number;
  freeScanLimit: number;
  activePlan: {
    plan: 'monthly' | 'annual';
    status: 'active';
    ends_at: string;
    razorpay_subscription_id: string;
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
