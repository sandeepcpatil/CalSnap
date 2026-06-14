const { supabase } = require('../lib/supabase');

/**
 * Checks that the authenticated user exists in the admin_users table.
 * Must run AFTER authMiddleware so req.user is already set.
 */
async function adminAuthMiddleware(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', req.user.id)
    .single();

  if (error || !data) {
    return res.status(403).json({ error: 'Forbidden: admin access only' });
  }

  next();
}

module.exports = adminAuthMiddleware;
