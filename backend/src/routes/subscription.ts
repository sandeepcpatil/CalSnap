import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import type { SubscriptionStatusResponse } from '@shared/types';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

// ─── RevenueCat config ─────────────────────────────────────────────────────────
// Entitlement identifier configured in the RevenueCat dashboard.
const PRO_ENTITLEMENT = 'pro';
const FREE_DAILY_SCAN_LIMIT = 2;
const REVENUECAT_API = 'https://api.revenuecat.com/v1';

const rcSecret = process.env.REVENUECAT_SECRET_KEY;
const rcWebhookAuth = process.env.REVENUECAT_WEBHOOK_AUTH;

// ─── Types ──────────────────────────────────────────────────────────────────────

interface EntitlementState {
  active: boolean;
  expiresAt: string | null; // ISO, null = lifetime
  plan: 'monthly' | 'annual' | null;
}

interface RevenueCatEntitlement {
  expires_date: string | null;
  product_identifier?: string;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planFromProductId(productId: string | undefined): 'monthly' | 'annual' {
  return productId && /annual|year/i.test(productId) ? 'annual' : 'monthly';
}

/**
 * Read the authoritative Pro entitlement for a user from RevenueCat.
 * RevenueCat is the source of truth for what the user actually purchased.
 */
async function fetchEntitlement(appUserId: string): Promise<EntitlementState> {
  if (!rcSecret) {
    throw new Error('REVENUECAT_SECRET_KEY must be set in environment');
  }

  const res = await fetch(`${REVENUECAT_API}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rcSecret}` },
  });

  if (!res.ok) {
    throw new Error(`RevenueCat lookup failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as RevenueCatSubscriberResponse;
  const ent = body.subscriber?.entitlements?.[PRO_ENTITLEMENT];

  if (!ent) {
    return { active: false, expiresAt: null, plan: null };
  }

  const expiresAt = ent.expires_date; // null => lifetime
  const active = expiresAt === null || new Date(expiresAt).getTime() > Date.now();

  return {
    active,
    expiresAt,
    plan: active ? planFromProductId(ent.product_identifier) : null,
  };
}

/**
 * Persist the entitlement state to Supabase. `profiles` is what the scan gate
 * reads, so it is the important one; the `subscriptions` row is best-effort
 * bookkeeping for the admin dashboard.
 */
async function applyProStatus(userId: string, state: EntitlementState): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      is_subscribed: state.active,
      subscription_end_date: state.active ? state.expiresAt : null,
    })
    .eq('id', userId);

  if (state.active && state.plan) {
    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: state.plan,
        status: 'active',
        ends_at: state.expiresAt,
      },
      { onConflict: 'user_id' },
    );
  } else {
    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'active');
  }
}

// ─── POST /api/subscription/sync ─────────────────────────────────────────────
// Called by the app right after a successful purchase/restore so the server-side
// scan gate unlocks immediately (instead of waiting for the async webhook).

router.post(
  '/sync',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const state = await fetchEntitlement(req.user!.id);
      await applyProStatus(req.user!.id, state);

      res.json({
        isSubscribed: state.active,
        subscriptionEndDate: state.expiresAt,
        activePlan: state.plan,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/subscription/webhook ──────────────────────────────────────────
// RevenueCat authenticates webhooks with a shared secret sent in the
// Authorization header (configured in the RevenueCat dashboard). We re-read the
// authoritative state from RevenueCat rather than trusting the event payload.

router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!rcWebhookAuth) {
        console.error('[Webhook] REVENUECAT_WEBHOOK_AUTH not configured');
        res.status(500).json({ error: 'Webhook not configured' });
        return;
      }

      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${rcWebhookAuth}`) {
        console.warn('[Webhook] Rejected: bad Authorization header');
        res.status(401).json({ error: 'Invalid webhook authorization' });
        return;
      }

      const event = (req.body as {
        event?: { app_user_id?: string; original_app_user_id?: string; type?: string };
      })?.event;
      const appUserId = event?.app_user_id ?? event?.original_app_user_id;

      if (appUserId) {
        const state = await fetchEntitlement(appUserId);
        await applyProStatus(appUserId, state);
        console.log(`[Webhook] ${event?.type ?? 'event'} → user=${appUserId} pro=${state.active}`);
      }

      // Always 2xx so RevenueCat doesn't retry a well-formed, authorized event.
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/subscription/status ────────────────────────────────────────────

router.get(
  '/status',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_end_date, scan_count')
        .eq('id', req.user!.id)
        .single<{ is_subscribed: boolean; subscription_end_date: string | null; scan_count: number }>();

      if (profileError || !profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const { data: activePlan } = await supabase
        .from('subscriptions')
        .select('plan, status, ends_at')
        .eq('user_id', req.user!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single<{ plan: string; status: string; ends_at: string }>();

      const response: SubscriptionStatusResponse = {
        isSubscribed: profile.is_subscribed,
        subscriptionEndDate: profile.subscription_end_date,
        scanCount: profile.scan_count,
        freeScanLimit: FREE_DAILY_SCAN_LIMIT,
        activePlan: activePlan
          ? {
              plan: activePlan.plan as 'monthly' | 'annual',
              status: 'active',
              ends_at: activePlan.ends_at,
            }
          : null,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
