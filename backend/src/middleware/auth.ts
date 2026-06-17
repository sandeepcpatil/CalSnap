import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches `req.user = { id, email }` on success.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = { id: data.user.id, email: data.user.email ?? '' };
  next();
}
