import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkAdmin } from '../lib/adminApi';
import { supabase } from '../lib/supabase';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
];

/**
 * Public site header.
 *
 * The Admin link is rendered only for users who are actually in `admin_users`,
 * verified server-side via `/api/admin/check`. This is presentation only — it
 * hides a link, it does not protect anything. The real gate is
 * `adminAuthMiddleware` on every `/api/admin/*` route, so typing /admin by hand
 * gets you a dashboard that can't load any data.
 */
export function SiteNav() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const run = () => { void checkAdmin().then((v) => { if (active) setIsAdmin(v); }); };
    run();
    // Re-check when auth changes, so signing in reveals the link immediately.
    const { data } = supabase.auth.onAuthStateChange(() => run());
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink-bg/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-widest text-content-primary">
          CAL<span className="text-brand">SNAP</span>
        </Link>

        <div className="ml-auto hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-content-secondary transition hover:text-brand">
              {l.label}
            </a>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-bold text-brand transition hover:bg-brand/20"
            >
              Admin
            </Link>
          )}
          <a
            href="#download"
            className="rounded-full bg-brand px-5 py-2 text-sm font-extrabold text-brand-on transition hover:opacity-90"
          >
            Get the app
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-content-secondary md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-hairline px-5 pb-4 md:hidden">
          <div className="flex flex-col gap-3 pt-3">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-semibold text-content-secondary">
                {l.label}
              </a>
            ))}
            {isAdmin && (
              <Link to="/admin" className="text-sm font-bold text-brand">Admin</Link>
            )}
            <a
              href="#download"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full bg-brand px-5 py-2 text-center text-sm font-extrabold text-brand-on"
            >
              Get the app
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
