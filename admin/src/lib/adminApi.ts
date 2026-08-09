import { supabase } from './supabase';

/**
 * Client for the backend's `/api/admin/*` endpoints.
 *
 * WHY THIS EXISTS: the dashboard used to query Supabase directly from the
 * browser with the anon key. Those queries run as the signed-in user and are
 * therefore subject to RLS — and every policy is `auth.uid() = user_id`. So the
 * admin panel could only ever see the admin's OWN row, which is why "Total
 * users" read 1.
 *
 * The correct fix is NOT to loosen RLS (that would expose every user's data to
 * any signed-in app user). It's to go through the backend, which uses the
 * service-role key and is gated by `adminAuthMiddleware` — a real membership
 * check against the `admin_users` table.
 *
 * Supabase is still used directly for AUTH; only data reads moved.
 */

const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? '';

export const backendConfigured = BASE_URL.length > 0;

async function adminFetch<T>(path: string): Promise<T> {
  if (!backendConfigured) {
    throw new Error('VITE_BACKEND_URL is not set — the admin API cannot be reached.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('This account is not an admin. Add it to the admin_users table.');
    }
    throw new Error(body?.error ?? body?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

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
  email: string | null;
  created_at: string;
  scan_count: number;
  is_subscribed: boolean;
  subscription_end_date?: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number | null;
  page: number;
  limit: number;
}

/** `{ "2026-08-09": 3, … }` keyed by ISO day. */
export type DayBuckets = Record<string, number>;

/**
 * Whether the signed-in user is an admin. Returns false (rather than throwing)
 * for signed-out users and any backend trouble — the public site must render
 * fine without a backend, it just won't show the Admin link.
 */
export async function checkAdmin(): Promise<boolean> {
  try {
    const { isAdmin } = await adminFetch<{ isAdmin: boolean }>('/api/admin/check');
    return isAdmin;
  } catch {
    return false;
  }
}

export const getStats = () => adminFetch<AdminStats>('/api/admin/stats');

export const getSignups = (days = 30) =>
  adminFetch<{ signups: DayBuckets }>(`/api/admin/signups?days=${days}`);

export const getScans = (days = 30) =>
  adminFetch<{ scans: DayBuckets }>(`/api/admin/scans?days=${days}`);

export const getUsers = (page: number, limit: number, search: string) =>
  adminFetch<AdminUsersResponse>(
    `/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
  );

export const getUser = <T = Record<string, unknown>>(userId: string) =>
  adminFetch<{ user: T }>(`/api/admin/users/${userId}`);

export interface AdminLog {
  id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string | null;
  logged_at: string;
  image_url: string | null;
}

export const getUserLogs = (userId: string, page = 1, limit = 20) =>
  adminFetch<{ logs: AdminLog[]; total: number | null }>(
    `/api/admin/users/${userId}/logs?page=${page}&limit=${limit}`,
  );

/** Turn day-keyed buckets into the sorted label/data pair the charts expect. */
export function toChartSeries(buckets: DayBuckets): { labels: string[]; data: number[] } {
  const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  return {
    // Backend keys are full ISO days; the chart shows MM-DD.
    labels: sorted.map(([k]) => k.slice(5, 10)),
    data: sorted.map(([, v]) => v),
  };
}
