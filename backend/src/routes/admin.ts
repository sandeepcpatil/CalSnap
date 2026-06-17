import { Router, type Request, type Response, type NextFunction } from 'express';
import type {
  AdminStats,
  AdminUsersResponse,
  AdminLogsResponse,
  ScanHistoryItem,
} from '@shared/types';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { supabase } from '../lib/supabase';

const router = Router();

// All admin routes require auth + admin role check
router.use(authMiddleware, adminAuthMiddleware);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = new Date();
      const last24h  = new Date(now.getTime() - 24  * 60 * 60 * 1000).toISOString();
      const last7d   = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000).toISOString();
      const last30d  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000).toISOString();

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

      const uniqueToday = new Set(activeToday.data?.map((r: { user_id: string }) => r.user_id)).size;
      const uniqueWeek  = new Set(activeWeek.data?.map((r: { user_id: string }) => r.user_id)).size;
      const uniqueMonth = new Set(activeMonth.data?.map((r: { user_id: string }) => r.user_id)).size;

      const monthlySubs = subscribers.data?.filter((s: { plan: string }) => s.plan === 'monthly').length ?? 0;
      const annualSubs  = subscribers.data?.filter((s: { plan: string }) => s.plan === 'annual').length ?? 0;
      // Annual: ₹999/12 ≈ ₹83/mo — count at monthly equivalent for MRR display
      const mrrPaise = monthlySubs * 14900 + annualSubs * 8325;

      const body: AdminStats = {
        totalUsers: totalUsers ?? 0,
        activeToday: uniqueToday,
        activeThisWeek: uniqueWeek,
        activeThisMonth: uniqueMonth,
        totalProSubscribers: subscribers.data?.length ?? 0,
        monthlyRevenuePaise: mrrPaise,
      };

      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/admin/signups?days=30 ──────────────────────────────────────────

router.get(
  '/signups',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days  = Math.min(parseInt(String(req.query['days'] ?? '30'), 10) || 30, 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const buckets: Record<string, number> = {};
      data?.forEach((row: { created_at: string }) => {
        const day = row.created_at.slice(0, 10);
        buckets[day] = (buckets[day] ?? 0) + 1;
      });

      res.json({ signups: buckets });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/admin/scans?days=30 ────────────────────────────────────────────

router.get(
  '/scans',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days  = Math.min(parseInt(String(req.query['days'] ?? '30'), 10) || 30, 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('food_logs')
        .select('logged_at')
        .gte('logged_at', since)
        .order('logged_at', { ascending: true });

      if (error) throw error;

      const buckets: Record<string, number> = {};
      data?.forEach((row: { logged_at: string }) => {
        const day = row.logged_at.slice(0, 10);
        buckets[day] = (buckets[day] ?? 0) + 1;
      });

      res.json({ scans: buckets });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/admin/users?page=1&limit=20&search=email ───────────────────────

router.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page   = Math.max(parseInt(String(req.query['page']  ?? '1'),  10) || 1, 1);
      const limit  = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10) || 20, 100);
      const search = String(req.query['search'] ?? '').trim();
      const offset = (page - 1) * limit;

      let query = supabase
        .from('profiles')
        .select(
          'id, name, email, created_at, scan_count, is_subscribed, subscription_end_date',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const body: AdminUsersResponse = { users: data ?? [], total: count, page, limit };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/admin/users/:userId/logs?page=1&limit=20 ───────────────────────

router.get(
  '/users/:userId/logs',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as { userId: string };
      const page  = Math.max(parseInt(String(req.query['page']  ?? '1'),  10) || 1, 1);
      const limit = Math.min(parseInt(String(req.query['limit'] ?? '20'), 10) || 20, 100);
      const offset = (page - 1) * limit;

      const { data, count, error } = await supabase
        .from('food_logs')
        .select(
          'id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, logged_at, image_url',
          { count: 'exact' },
        )
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const body: AdminLogsResponse = {
        logs: (data ?? []) as ScanHistoryItem[],
        total: count,
        page,
        limit,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
