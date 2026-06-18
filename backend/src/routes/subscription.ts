import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  SubscriptionStatusResponse,
} from '@shared/types';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

// ─── Razorpay Setup ───────────────────────────────────────────────────────────

const rzpKeyId = process.env.RAZORPAY_KEY_ID;
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (!rzpKeyId || !rzpKeySecret) {
  throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment');
}

const razorpay = new Razorpay({ key_id: rzpKeyId, key_secret: rzpKeySecret });

// ─── Plan Config ──────────────────────────────────────────────────────────────
// Amounts in paise (1 INR = 100 paise): ₹149 = 14900, ₹999 = 99900

interface PlanConfig {
  amount: number;
  period: 'monthly' | 'yearly';
  interval: number;
}

const PLANS: Record<'monthly' | 'annual', PlanConfig> = {
  monthly: { amount: 14900, period: 'monthly', interval: 1 },
  annual:  { amount: 99900, period: 'yearly',  interval: 1 },
};

// ─── POST /api/subscription/create-order ──────────────────────────────────────

router.post(
  '/create-order',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan } = req.body as CreateOrderRequest;

      if (!plan || !(plan in PLANS)) {
        res.status(400).json({ error: 'Invalid plan. Choose "monthly" or "annual".' });
        return;
      }

      const planConfig = PLANS[plan as 'monthly' | 'annual'];

      const razorpayPlan = await razorpay.plans.create({
        period: planConfig.period,
        interval: planConfig.interval,
        item: {
          name: `CalSnap Pro - ${plan}`,
          amount: planConfig.amount,
          currency: 'INR',
          description: `CalSnap Pro ${plan} subscription`,
        },
      });

      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlan.id,
        customer_notify: 1,
        total_count: plan === 'annual' ? 1 : 12,
        notes: {
          user_id: req.user!.id,
          plan,
        },
      });

      const response: CreateOrderResponse = {
        subscriptionId: subscription.id,
        razorpayKeyId: rzpKeyId,
        plan,
        amount: planConfig.amount,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/subscription/webhook ──────────────────────────────────────────
// CRITICAL: Always verify HMAC-SHA256 signature before processing.
// Never trust the payload without verification — replay & tampering attacks.

router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!signature || typeof signature !== 'string' || !webhookSecret) {
        res.status(400).json({ error: 'Missing signature or webhook secret' });
        return;
      }

      // req.body is a raw Buffer here (see express.raw() in index.ts)
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body as Buffer)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        console.warn('[Webhook] Signature mismatch — possible tampering attempt');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const event = JSON.parse((req.body as Buffer).toString()) as RazorpayWebhookEvent;
      const { event: eventType, payload } = event;

      console.log(`[Webhook] Received: ${eventType}`);

      if (eventType === 'subscription.activated') {
        await handleSubscriptionActivated(payload.subscription.entity);
      } else if (eventType === 'subscription.charged') {
        await handleSubscriptionCharged(payload.subscription.entity);
      } else if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired') {
        await handleSubscriptionEnded(payload.subscription.entity);
      }

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
        .select('plan, status, ends_at, razorpay_subscription_id')
        .eq('user_id', req.user!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single<{ plan: string; status: string; ends_at: string; razorpay_subscription_id: string }>();

      const response: SubscriptionStatusResponse = {
        isSubscribed: profile.is_subscribed,
        subscriptionEndDate: profile.subscription_end_date,
        scanCount: profile.scan_count,
        freeScanLimit: FREE_DAILY_SCAN_LIMIT,
        activePlan: activePlan
          ? {
              plan: activePlan.plan as 'monthly' | 'annual',
              status: activePlan.status as 'active',
              ends_at: activePlan.ends_at,
              razorpay_subscription_id: activePlan.razorpay_subscription_id,
            }
          : null,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

const FREE_DAILY_SCAN_LIMIT = 3;

// ─── Webhook Handlers ─────────────────────────────────────────────────────────

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  notes?: { user_id?: string; plan?: string };
}

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    subscription: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: Record<string, unknown> };
  };
}

async function handleSubscriptionActivated(subscription: RazorpaySubscriptionEntity): Promise<void> {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  const plan = subscription.notes?.plan ?? 'monthly';
  const endsAt = computeEndsAt(plan);

  await supabase
    .from('profiles')
    .update({ is_subscribed: true, subscription_end_date: endsAt.toISOString() })
    .eq('id', userId);

  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      plan,
      status: 'active',
      razorpay_subscription_id: subscription.id,
      amount_paise: plan === 'annual' ? 99900 : 14900,
      ends_at: endsAt.toISOString(),
    },
    { onConflict: 'razorpay_subscription_id' },
  );
}

async function handleSubscriptionCharged(subscription: RazorpaySubscriptionEntity): Promise<void> {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  const plan = subscription.notes?.plan ?? 'monthly';
  const endsAt = computeEndsAt(plan);

  await supabase
    .from('profiles')
    .update({ is_subscribed: true, subscription_end_date: endsAt.toISOString() })
    .eq('id', userId);
}

async function handleSubscriptionEnded(subscription: RazorpaySubscriptionEntity): Promise<void> {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  await supabase
    .from('profiles')
    .update({ is_subscribed: false, subscription_end_date: null })
    .eq('id', userId);

  await supabase
    .from('subscriptions')
    .update({ status: subscription.status === 'cancelled' ? 'cancelled' : 'expired' })
    .eq('razorpay_subscription_id', subscription.id);
}

function computeEndsAt(plan: string): Date {
  const ms = plan === 'annual'
    ? 365 * 24 * 60 * 60 * 1000
    :  30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

export default router;
