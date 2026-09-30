import { Router, type Router as ExpressRouter, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

/** Bucket the app uploads meal photos to, under a `<userId>/` prefix (see ScanScreen). */
const FOOD_IMAGE_BUCKET = 'food-images';
const STORAGE_PAGE = 100;

/**
 * Remove every object under the user's own prefix. Storage objects do not
 * cascade with the auth user, so this runs first; if it fails the whole
 * request fails and the user can retry, rather than leaving orphaned photos
 * behind an account that no longer exists.
 */
async function removeUserImages(userId: string): Promise<void> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(FOOD_IMAGE_BUCKET)
      .list(userId, { limit: STORAGE_PAGE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const obj of data) paths.push(`${userId}/${obj.name}`);
    if (data.length < STORAGE_PAGE) break;
    offset += STORAGE_PAGE;
  }

  for (let i = 0; i < paths.length; i += STORAGE_PAGE) {
    const { error } = await supabase.storage
      .from(FOOD_IMAGE_BUCKET)
      .remove(paths.slice(i, i + STORAGE_PAGE));
    if (error) throw error;
  }
}

// ─── DELETE /api/account ──────────────────────────────────────────────────────
// Deletes the caller's own account. The subject is always the id from the
// verified JWT — nothing in the body or query can point this at another user.
// `auth.admin.deleteUser` cascades to profiles → food_logs / subscriptions
// (see database/schema.sql).

router.delete(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      await removeUserImages(userId);

      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      res.status(204).end();
    } catch (err) {
      // Detail stays server-side; the client gets one fixed sentence.
      console.error(
        '[account] delete failed',
        { userId },
        err instanceof Error ? err.message : err,
      );
      res.status(500).json({ error: 'Could not delete the account. Please try again later.' });
    }
  },
);

export default router;
