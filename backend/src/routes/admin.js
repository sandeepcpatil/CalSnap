const express = require('express');
const authMiddleware = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/adminAuth');
const { supabase } = require('../lib/supabase');

const router = express.Router();

// All admin routes require auth + admin role check
router.use(authMiddleware, adminAuthMiddleware);

/**
 * GET /api/admin/stats
 * Returns KPI metrics for the admin dashboard.
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      activeToday,
      activeWeek,
      activeMonth,
      subscribers,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('food_logs').select('user_id').gte('logged_at', last24h),
      supabase.from('food_logs').select('user_id').gte('logged_at', last7d),
      supabase.from('food_logs').select('user_id').gte('logged_at', last30d),
      supabase.from('subscriptions').select('plan').eq('status', 'active'),
    ]);

    const uniqueActiveToday = new Set(activeToday.data?.map(r => r.user_id)).size;
    const uniqueActiveWeek = new Set(activeWeek.data?.map(r => r.user_id)).size;
    const uniqueActiveMonth = new Set(activeMonth.data?.map(r => r.user_id)).size;

    const monthlySubs = subscribers.data?.filter(s => s.plan === 'monthly').length ?? 0;
    const annualSubs = subscribers.data?.filter(s => s.plan === 'annual').length ?? 0;
    const monthlyRevenue = monthlySubs * 150 + annualSubs * 100; // ₹100/mo for annual

    res.json({
      totalUsers: totalUsers ?? 0,
      activeToday: uniqueActiveToday,
      activeThisWeek: uniqueActiveWeek,
      activeThisMonth: uniqueActiveMonth,
      totalProSubscribers: (subscribers.data?.length ?? 0),
      monthlyRevenuePaise: monthlyRevenue,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/signups?days=30
 * Daily new user signups for the last N days.
 */
router.get('/signups', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Bucket by day
    const buckets = {};
    data?.forEach(row => {
      const day = row.created_at.slice(0, 10);
      buckets[day] = (buckets[day] || 0) + 1;
    });

    res.json({ signups: buckets });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/scans?days=30
 * Daily scan counts for the last N days.
 */
router.get('/scans', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('food_logs')
      .select('logged_at')
      .gte('logged_at', since)
      .order('logged_at', { ascending: true });

    if (error) throw error;

    const buckets = {};
    data?.forEach(row => {
      const day = row.logged_at.slice(0, 10);
      buckets[day] = (buckets[day] || 0) + 1;
    });

    res.json({ scans: buckets });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users?page=1&limit=20&search=email
 * Paginated user list with optional email search.
 */
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const search = req.query.search?.trim() || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('profiles')
      .select('id, name, email, created_at, scan_count, is_subscribed, subscription_end_date', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      // Partial match on email — safe because supabase parameterizes internally
      query = query.ilike('email', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ users: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users/:userId/logs?page=1&limit=20
 * Food log history for a specific user.
 */
router.get('/users/:userId/logs', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
      .from('food_logs')
      .select('id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, logged_at, image_url', { count: 'exact' })
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ logs: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
