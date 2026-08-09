import { SiteNav } from '../components/SiteNav';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.sanverse.calsnapapp';
const SUPPORT_EMAIL = 'calsnap.support@gmail.com';

/**
 * The public CalSnap website.
 *
 * Every claim here maps to a feature that actually ships — the same discipline
 * as the Play listing. No invented screenshots, no "coming soon" dressed up as
 * present tense; iOS is explicitly marked as not yet available.
 */

const FEATURES = [
  {
    icon: '📸',
    title: 'Snap a meal, get the numbers',
    body: 'Point your camera at a plate and CalSnap breaks it into individual items — dal, rice, two rotis — each with its own calories and macros. Fix any portion before you log it.',
    accent: 'text-brand',
  },
  {
    icon: '🏷️',
    title: 'Label & barcode scanning',
    body: 'Scan a nutrition label or a barcode and get a 0–100 health score with the actual reason behind it — not just a number, but which nutrient dragged it down.',
    accent: 'text-macro-carbs',
  },
  {
    icon: '🎙️',
    title: 'Just say what you ate',
    body: 'No camera handy? Describe the meal out loud. "Two rotis, a katori of dal and curd" is a complete log.',
    accent: 'text-macro-protein',
  },
  {
    icon: '🇮🇳',
    title: 'Built for Indian food',
    body: 'Portions in katori, roti and glass — not cups and ounces. Backed by 7,900+ foods from IFCT and USDA, so dal and poha are as accurate as oats.',
    accent: 'text-macro-fiber',
  },
  {
    icon: '💧',
    title: 'Water & weight tracking',
    body: 'A hydration goal derived from your weight and activity, and a weight trend line that shows where you are actually heading — not just today’s number.',
    accent: 'text-brand',
  },
  {
    icon: '✨',
    title: 'Your week, reviewed',
    body: 'Every week Pro members get a personal breakdown of calories, protein, hydration and sodium — with one specific thing to focus on next.',
    accent: 'text-macro-fat',
  },
];

const STEPS = [
  { n: '1', title: 'Snap or say it', body: 'Photo, barcode, voice, or pick from foods you have logged before.' },
  { n: '2', title: 'Check the items', body: 'CalSnap splits the meal up. Adjust a portion or add anything it missed.' },
  { n: '3', title: 'Watch the trend', body: 'Daily rings, weekly reviews, and a weight trend that tells you if it is working.' },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-black text-content-primary sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-content-muted">{label}</p>
    </div>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-ink-bg text-content-primary antialiased">
      <SiteNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Soft brand glow behind the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #85D3DA 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 text-center sm:pt-24">
          <span className="inline-block rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand">
            AI calorie counter
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-[1.1] tracking-tight sm:text-6xl">
            Stop guessing what's
            <br className="hidden sm:block" />{' '}
            <span className="bg-brand-grad bg-clip-text text-transparent">on your plate</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-content-secondary sm:text-lg">
            One photo turns your meal into calories, protein, carbs and fat — in seconds.
            Built for the way India actually eats.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={PLAY_URL}
              target="_blank"
              rel="noreferrer"
              className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-brand px-7 py-4 font-extrabold text-brand-on transition hover:opacity-90 sm:w-auto"
            >
              <svg width="20" height="22" viewBox="0 0 512 512" fill="currentColor" aria-hidden>
                <path d="M99 24a24 24 0 00-11 20v424a24 24 0 0011 20l232-232zm264 200L131 8l246 138a24 24 0 010 42zm0 64l14 8a24 24 0 010 42L131 504z" />
              </svg>
              <span>Get it on Google Play</span>
            </a>

            <span
              className="flex w-full max-w-xs cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-hairline bg-ink-surface px-7 py-4 font-bold text-content-muted sm:w-auto"
              title="Not available yet"
            >
              <svg width="18" height="22" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
                <path d="M318 268c-1-58 47-86 49-88-27-39-69-44-83-45-36-4-70 21-88 21s-46-20-76-20c-39 1-75 23-95 58-40 70-10 173 29 230 19 28 42 59 72 58 29-1 40-19 75-19s45 19 76 18c31-1 51-28 70-56 22-32 31-63 32-64-1-1-61-24-61-93zM260 66c16-19 27-46 24-73-23 1-51 15-68 34-15 17-28 44-24 70 26 2 52-13 68-31z" />
              </svg>
              <span>iOS — coming soon</span>
            </span>
          </div>

          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-hairline pt-8">
            <Stat value="7,900+" label="Foods in database" />
            <Stat value="4 ways" label="To log a meal" />
            <Stat value="Seconds" label="Per entry" />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Everything you need to track honestly</h2>
          <p className="mt-4 text-content-secondary">
            Accuracy over guesswork: numbers come from a real food database wherever possible, and
            you always get to correct them before anything is logged.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-hairline bg-ink-surface p-6 transition hover:border-brand/30"
            >
              <div className={`text-3xl ${f.accent}`}>{f.icon}</div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-content-secondary">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-y border-hairline bg-ink-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">Three steps, then it's a habit</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-xl font-black text-brand">
                  {s.n}
                </div>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-content-secondary">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-5xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Simple pricing</h2>
          <p className="mt-4 text-content-secondary">Start free. Upgrade only if it earns its place.</p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-hairline bg-ink-surface p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-content-muted">Free</h3>
            <p className="mt-3 text-4xl font-black">₹0</p>
            <ul className="mt-6 space-y-3 text-sm text-content-secondary">
              {['2 AI scans every day', 'Unlimited barcode scans', 'Water & weight tracking', 'Your last 7 days of history'].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="text-state-success">✓</span>{t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-2xl border border-brand/40 bg-brand/[0.07] p-8">
            <span className="absolute -top-3 left-8 rounded-full bg-brand px-3 py-1 text-[11px] font-black uppercase tracking-widest text-brand-on">
              7-day free trial
            </span>
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand">Pro</h3>
            <p className="mt-3 text-4xl font-black">
              ₹199<span className="text-base font-semibold text-content-muted">/month</span>
            </p>
            <p className="mt-1 text-sm text-content-muted">or ₹1,299/year — about ₹108 a month</p>
            <ul className="mt-6 space-y-3 text-sm text-content-secondary">
              {[
                '20 AI scans every day',
                'Weekly AI review of your week',
                'Full macro breakdown & insights',
                '90 days of history + Excel export',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="text-state-success">✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section id="download" className="mx-auto max-w-5xl px-5 pb-24">
        <div className="rounded-3xl border border-hairline bg-gradient-to-b from-ink-surface to-ink-bg p-10 text-center sm:p-14">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Start with your next meal</h2>
          <p className="mx-auto mt-4 max-w-md text-content-secondary">
            Free to download. No card needed to try Pro for a week.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={PLAY_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full max-w-xs rounded-2xl bg-brand px-8 py-4 font-extrabold text-brand-on transition hover:opacity-90 sm:w-auto"
            >
              Download for Android
            </a>
            <span className="text-sm text-content-muted">iOS is on the way</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-10 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-base font-extrabold tracking-widest">
              CAL<span className="text-brand">SNAP</span>
            </p>
            <p className="mt-1 text-xs text-content-muted">
              © {new Date().getFullYear()} CalSnap. Made in India.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary">
            <a href="/privacy.html" className="transition hover:text-brand">Privacy</a>
            <a href="/terms.html" className="transition hover:text-brand">Terms</a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="transition hover:text-brand">Support</a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-8 text-center text-[11px] leading-relaxed text-content-muted sm:text-left">
          CalSnap provides general nutrition information and is not a substitute for professional
          medical advice. AI estimates from photos are approximations — always check the items
          before logging.
        </p>
      </footer>
    </div>
  );
}
