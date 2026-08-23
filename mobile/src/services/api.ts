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

/** One identified food on the plate — the unit the user edits before logging. */
export interface FoodItem {
  name: string;
  quantity: number;
  /** katori | roti | cup | piece | tbsp | tsp | glass | plate | slice | g */
  unit: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Sodium in mg. Real from the foods table / label; an estimate for photos. */
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
  /** 'database' when macros came from the foods table, 'ai' when estimated. */
  source?: 'database' | 'ai';
  /** Canonical food matched in the database, when source is 'database'. */
  matched_name?: string;
}

export interface FoodAnalysisResult {
  food_name: string;
  /** Per-item breakdown. Empty for legacy cached scans — UI falls back to a single row. */
  items: FoodItem[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
  /** Estimated total weight in grams. 0 when the AI (or an older cached scan) didn't report one. */
  portion_g: number;
  /** Human-readable portion, e.g. "1 medium katori". Empty when unknown. */
  portion_desc: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export async function analyzeFood(imageUrl: string, token: string, description?: string): Promise<{ result: FoodAnalysisResult; cached: boolean }> {
  return apiFetch('/api/analyze-food', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, description }),
  }, token);
}

/**
 * Log a meal from a spoken or typed description.
 * Returns the same shape as `analyzeFood`, so the result renders on the normal
 * editable-items screen with no special casing.
 */
export async function analyzeText(description: string, token: string): Promise<{ result: FoodAnalysisResult; cached: boolean }> {
  return apiFetch('/api/analyze-text', {
    method: 'POST',
    body: JSON.stringify({ description }),
  }, token);
}

/**
 * Log a meal by voice: the recorded clip (base64) goes straight to Gemini for
 * transcription + interpretation. `mimeType` is 'audio/wav' on iOS and
 * 'audio/aac' on Android — both formats Gemini accepts natively.
 */
export async function analyzeVoice(
  audioBase64: string,
  mimeType: string,
  token: string,
): Promise<{ result: FoodAnalysisResult; cached: boolean }> {
  return apiFetch('/api/analyze-voice', {
    method: 'POST',
    body: JSON.stringify({ audio: audioBase64, mimeType }),
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
 * Look up a packaged product by its barcode (Open Food Facts, write-through
 * cached server-side). Returns the same shape as a label scan, so the result
 * renders on the normal LabelResult screen. No AI, so it never uses a scan.
 */
export async function lookupBarcode(
  code: string,
  token: string,
): Promise<{ result: LabelScanData; image_url: string | null; cached: boolean }> {
  return apiFetch(`/api/barcode/${encodeURIComponent(code)}`, { method: 'GET' }, token);
}

/**
 * Ask the backend to re-read entitlements from RevenueCat and update the
 * user's profile immediately (so the server-side scan gate unlocks without
 * waiting for the async webhook). Call right after a successful purchase.
 */
// ─── Weekly recap ────────────────────────────────────────────────────────────

export interface RecapStats {
  week_start: string;
  week_end: string;
  week_label: string;
  days_logged: number;
  avg_calories: number;
  calorie_goal: number;
  avg_protein: number;
  protein_goal: number;
  days_protein_low: number;
  water_goal_ml: number;
  days_water_goal_hit: number;
  days_with_water: number;
  weight_change_kg: number | null;
  best_protein_day_kg: number | null;
  avg_sodium_mg: number;
  days_high_sodium: number;
}

export interface RecapContent {
  headline: string;
  summary: string;
  insights: string[];
  tip: string;
  ai: boolean;
}

export interface WeeklyRecap {
  week_start: string;
  stats: RecapStats;
  content: RecapContent;
}

/**
 * The most recently completed week's review. `locked: true` means the user
 * isn't Pro (show the upsell teaser); `recap: null` with `locked: false` would
 * be unusual but is handled as "nothing to show yet".
 */
export async function getWeeklyRecap(token: string): Promise<{ locked: boolean; recap: WeeklyRecap | null }> {
  return apiFetch('/api/recap', { method: 'GET' }, token);
}

// ─── Nutrition coach (chat) ──────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatHistory {
  enabled: boolean;
  messages: ChatMessage[];
  used_today: number;
  daily_limit: number;
}

export interface ChatReply {
  reply: string;
  used_today: number;
  daily_limit: number;
  /** True when the deterministic safety layer answered instead of the model. */
  safety: boolean;
}

export async function getChatHistory(token: string): Promise<ChatHistory> {
  return apiFetch('/api/chat/history', { method: 'GET' }, token);
}

export async function sendChatMessage(message: string, token: string): Promise<ChatReply> {
  return apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }, token);
}

export async function clearChatHistory(token: string): Promise<{ ok: boolean }> {
  return apiFetch('/api/chat/history', { method: 'DELETE' }, token);
}

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
