// Augment the global Express namespace so req.user is typed everywhere.
// This file is auto-included by TypeScript because it lives under src/.
import type { AuthenticatedUser } from '@shared/types';

declare global {
  namespace Express {
    interface Request {
      /** Populated by authMiddleware after Supabase JWT verification */
      user?: AuthenticatedUser;
    }
  }
}
