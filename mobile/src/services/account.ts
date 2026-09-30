import Constants from 'expo-constants';

const BASE_URL =
  Constants.expoConfig?.extra?.backendUrl ??
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  'http://localhost:4000';

const TIMEOUT_MS = 20_000;

/**
 * Permanently deletes the signed-in user's account via the backend, which
 * removes the auth user (cascading to profile, meals, weight and water logs)
 * and their meal photos.
 *
 * Resolves on success and throws otherwise. Callers show their own fixed copy;
 * the thrown detail is for logging only and must never reach the screen.
 */
export async function deleteAccount(accessToken: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Account delete failed with status ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}
