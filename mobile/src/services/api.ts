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

export async function analyzeFood(imageUrl: string, token: string): Promise<{ result: FoodAnalysisResult; cached: boolean }> {
  return apiFetch('/api/analyze-food', {
    method: 'POST',
    body: JSON.stringify({ imageUrl }),
  }, token);
}

export async function createSubscriptionOrder(plan: 'monthly' | 'annual', token: string) {
  return apiFetch<{ subscriptionId: string; razorpayKeyId: string; plan: string; amount: number }>(
    '/api/subscription/create-order',
    { method: 'POST', body: JSON.stringify({ plan }) },
    token
  );
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
