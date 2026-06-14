const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/auth');
const { supabase } = require('../lib/supabase');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plan definitions (amounts in paise: 1 INR = 100 paise)
const PLANS = {
  monthly: { amount: 15000, period: 'monthly', interval: 1 },
  annual: { amount: 120000, period: 'yearly', interval: 1 },
};

/**
 * POST /api/subscription/create-order
 * Creates a Razorpay order for one-time checkout (used to initiate subscription).
 */
router.post('/create-order', authMiddleware, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose "monthly" or "annual".' });
    }

    const planConfig = PLANS[plan];

    // Create or fetch Razorpay plan
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

    // Create subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlan.id,
      customer_notify: 1,
      total_count: plan === 'annual' ? 1 : 12,
      notes: {
        user_id: req.user.id,
        plan,
      },
    });

    res.json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      plan,
      amount: planConfig.amount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscription/webhook
 * Receives Razorpay webhook events.
 * CRITICAL: Always verify signature before processing — never trust unverified payloads.
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    // Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // req.body is raw Buffer (see index.js)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      console.warn('[Webhook] Signature mismatch — possible tampering attempt');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());
    const { event: eventType, payload } = event;

    console.log(`[Webhook] Received event: ${eventType}`);

    if (eventType === 'subscription.activated') {
      await handleSubscriptionActivated(payload.subscription.entity);
    } else if (eventType === 'subscription.charged') {
      await handleSubscriptionCharged(payload.subscription.entity, payload.payment?.entity);
    } else if (['subscription.cancelled', 'subscription.expired'].includes(eventType)) {
      await handleSubscriptionEnded(payload.subscription.entity);
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

async function handleSubscriptionActivated(subscription) {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  const plan = subscription.notes?.plan || 'monthly';
  const endsAt = plan === 'annual'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await supabase.from('profiles').update({
    is_subscribed: true,
    subscription_end_date: endsAt.toISOString(),
  }).eq('id', userId);

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    plan,
    status: 'active',
    razorpay_subscription_id: subscription.id,
    amount_paise: plan === 'annual' ? 120000 : 15000,
    ends_at: endsAt.toISOString(),
  }, { onConflict: 'razorpay_subscription_id' });
}

async function handleSubscriptionCharged(subscription, _payment) {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  const plan = subscription.notes?.plan || 'monthly';
  const endsAt = plan === 'annual'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await supabase.from('profiles').update({
    is_subscribed: true,
    subscription_end_date: endsAt.toISOString(),
  }).eq('id', userId);
}

async function handleSubscriptionEnded(subscription) {
  const userId = subscription.notes?.user_id;
  if (!userId) return;

  await supabase.from('profiles').update({
    is_subscribed: false,
    subscription_end_date: null,
  }).eq('id', userId);

  await supabase.from('subscriptions')
    .update({ status: subscription.status === 'cancelled' ? 'cancelled' : 'expired' })
    .eq('razorpay_subscription_id', subscription.id);
}

/**
 * GET /api/subscription/status
 * Returns the current user's subscription status.
 */
router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_end_date, scan_count')
      .eq('id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, ends_at, razorpay_subscription_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      isSubscribed: data.is_subscribed,
      subscriptionEndDate: data.subscription_end_date,
      scanCount: data.scan_count,
      freeScanLimit: 5,
      activePlan: sub || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
