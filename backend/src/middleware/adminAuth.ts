import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

/**
 * Checks that the authenticated user exists in the admin_users table.
 * Must run AFTER authMiddleware so req.user is already populated.
 */
export async function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', req.user.id)
    .single();

  if (error || !data) {
    res.status(403).json({ error: 'Forbidden: admin access only' });
    return;
  }

  next();
}
