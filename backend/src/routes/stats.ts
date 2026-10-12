import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

/** How far back the public accuracy figure looks. */
const WINDOW_DAYS = 90;
/** The figure is served from memory for this long between recomputes. */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface AccuracyStats {
  total: number;
  right: number;
  close: number;
  wrong: number;
  /** right + close as a whole-number percentage of total; 0 when there are no ratings. */
  confirmed_pct: number;
  window_days: typeof WINDOW_DAYS;
}

let cached: { value: AccuracyStats; expiresAt: number } | null = null;
let inFlight: Promise<AccuracyStats> | null = null;

async function countVerdict(verdict: 'right' | 'close' | 'wrong', since: string): Promise<number> {
  // head + exact count: the rows themselves never leave the database.
  const { count, error } = await supabase
    .from('scan_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('verdict', verdict)
    .gte('created_at', since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function computeAccuracy(): Promise<AccuracyStats> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const [right, close, wrong] = await Promise.all([
    countVerdict('right', since),
    countVerdict('close', since),
    countVerdict('wrong', since),
  ]);
  const total = right + close + wrong;
  const confirmed_pct = total > 0 ? Math.round(((right + close) / total) * 100) : 0;
  return { total, right, close, wrong, confirmed_pct, window_days: WINDOW_DAYS };
}

/**
 * Aggregate "Was this estimate right?" verdicts, cached in memory so a burst
 * of requests costs one database round trip per ten minutes. Concurrent
 * cache misses share a single computation.
 */
async function getAccuracy(): Promise<AccuracyStats> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (!inFlight) {
    inFlight = computeAccuracy()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

// ─── GET /api/stats/accuracy ──────────────────────────────────────────────────
// Public and parameter-free on purpose: it returns counts only, over a fixed
// window, and nothing from the request influences the query. Anything in the
// query string or body is ignored.

router.get('/accuracy', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await getAccuracy();
    res.set('Cache-Control', 'public, max-age=600');
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
