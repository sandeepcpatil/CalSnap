import Constants from 'expo-constants';

const BASE_URL =
  Constants.expoConfig?.extra?.backendUrl ??
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  'http://localhost:4000';

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message ?? data.error ?? 'Request failed');
    (error as any).statusCode = response.status;
    (error as any).code = data.error;
    throw error;
  }

  return data as T;
}

export interface FoodAnalysisResult {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export async function analyzeFood(imageUrl: string, token: string, description?: string): Promise<{ result: FoodAnalysisResult; cached: boolean }> {
  return apiFetch('/api/analyze-food', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, description }),
  }, token);
}

// ─── Label scan (packaged food) ──────────────────────────────────────────────

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

/** Deterministic health assessment computed server-side. */
export interface HealthScoreDetail {
  /** 0–100, higher = healthier. */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  /** One-line reason naming the biggest score drivers. Optional so the app
   *  tolerates a backend that hasn't been redeployed yet. */
  summary?: string;
  positives: string[];
  negatives: string[];
}

export interface LabelScanData {
  product_name: string;
  brand: string;
  /** Stated serving size in grams; 0 when not printed on the pack. */
  serving_g: number;
  is_beverage: boolean;
  per_100g: LabelNutrition;
  ingredients: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  health: HealthScoreDetail;
}

export async function analyzeLabel(imageUrl: string, token: string): Promise<{ result: LabelScanData; cached: boolean }> {
  return apiFetch('/api/analyze-label', {
    method: 'POST',
    body: JSON.stringify({ imageUrl }),
  }, token);
}

/**
 * Ask the backend to re-read entitlements from RevenueCat and update the
 * user's profile immediately (so the server-side scan gate unlocks without
 * waiting for the async webhook). Call right after a successful purchase.
 */
export async function syncSubscription(token: string) {
  return apiFetch<{
    isSubscribed: boolean;
    subscriptionEndDate: string | null;
    activePlan: string | null;
  }>('/api/subscription/sync', { method: 'POST' }, token);
}

export async function getDailyQuote(token: string): Promise<{ quote: string; date: string }> {
  return apiFetch<{ quote: string; date: string; source?: string }>('/api/daily-quote', {}, token);
}

export async function getSubscriptionStatus(token: string) {
  return apiFetch<{
    isSubscribed: boolean;
    subscriptionEndDate: string | null;
    scanCount: number;
    freeScanLimit: number;
    activePlan: { plan: string; status: string; ends_at: string } | null;
  }>('/api/subscription/status', {}, token);
}
