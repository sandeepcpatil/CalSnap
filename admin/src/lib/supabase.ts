import { createClient } from '@supabase/supabase-js';

/**
 * Vite inlines `import.meta.env.*` at BUILD time, so these must exist as
 * environment variables on the build machine (locally: `admin/.env`; on Vercel:
 * Project → Settings → Environment Variables). Setting them after a build has
 * no effect — the values are already baked into the bundle, which is why a
 * missing variable only ever surfaces in the browser.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Names the exact problem — `?? ''` used to hide it behind supabase-js's
 *  cryptic "supabaseUrl is required". */
export const missingEnv: string[] = [
  ...(supabaseUrl ? [] : ['VITE_SUPABASE_URL']),
  ...(supabaseAnonKey ? [] : ['VITE_SUPABASE_ANON_KEY']),
];

export const isConfigured = missingEnv.length === 0;

// Fall back to a syntactically valid placeholder so the module can still load
// and `main.tsx` can render a readable explanation instead of a blank page.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);
