import { Link } from 'react-router-dom';
import { SiteNav } from '../components/SiteNav';

const SUPPORT_EMAIL = 'calsnap.support@gmail.com';

/**
 * /data: the privacy policy as a table you can actually read.
 *
 * Mirrors mobile/src/screens/Profile/DataPrivacyScreen.tsx line for line.
 * Every sentence is checked against the backend (account.ts, analyze.ts,
 * barcode.ts). If one changes, change the other.
 */

const DATA_ROWS = [
  {
    label: 'Meal photos',
    usedFor: 'Sent to Google Gemini to estimate the items, calories and macros in a meal.',
    keptFor: 'Deleted from our storage 90 days after upload.',
  },
  {
    label: 'Voice clips',
    usedFor: 'Sent to Google Gemini to turn what you said into a meal entry.',
    keptFor: 'Not stored by us after the entry is created.',
  },
  {
    label: 'Nutrition logs',
    usedFor: 'Your daily totals, history, insights and export.',
    keptFor: 'Until you delete the entry or your account.',
  },
  {
    label: 'Water and weight',
    usedFor: 'Your hydration goal and weight trend.',
    keptFor: 'Until you delete the entry or your account.',
  },
  {
    label: 'Profile',
    usedFor: 'Height, weight, age, activity and goal set your daily targets.',
    keptFor: 'Until you change it or delete your account.',
  },
  {
    label: 'Account',
    usedFor: 'Your Google sign-in (name, email, photo) keeps your data tied to you.',
    keptFor: 'Until you delete your account.',
  },
];

const RECIPIENTS = [
  { name: 'Google Gemini', purpose: 'Analyses meal photos and transcribes voice clips.' },
  { name: 'Supabase', purpose: 'Hosts your account, logs and photos.' },
  { name: 'RevenueCat and Google Play', purpose: 'Handle Pro subscriptions. We never see your card details.' },
  { name: 'Open Food Facts', purpose: 'Looks up packaged foods. It receives the barcode only.' },
];

export function DataPage() {
  return (
    <div className="min-h-screen bg-ink-bg text-content-primary antialiased">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-14">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your data</h1>
        <p className="mt-4 text-content-secondary">
          What CalVue keeps, what it is used for and how long it stays. We do not sell your personal data.
        </p>

        {/* ── Data table ── */}
        <h2 className="mt-12 text-sm font-bold uppercase tracking-widest text-content-muted">What we keep</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-ink-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="hidden sm:table-header-group">
              <tr className="border-b border-hairline text-xs font-bold uppercase tracking-widest text-content-muted">
                <th scope="col" className="px-5 py-3">Data</th>
                <th scope="col" className="px-5 py-3">What it is used for</th>
                <th scope="col" className="px-5 py-3">Kept for</th>
              </tr>
            </thead>
            <tbody>
              {DATA_ROWS.map((row) => (
                <tr key={row.label} className="block border-b border-hairline last:border-b-0 sm:table-row">
                  <th scope="row" className="block px-5 pt-4 font-bold text-content-primary sm:table-cell sm:py-4 sm:align-top">
                    {row.label}
                  </th>
                  <td className="block px-5 pt-2 text-content-secondary sm:table-cell sm:py-4 sm:align-top">
                    <span className="block text-xs font-bold text-content-muted sm:hidden">What it is used for</span>
                    {row.usedFor}
                  </td>
                  <td className="block px-5 pb-4 pt-2 text-content-secondary sm:table-cell sm:py-4 sm:align-top">
                    <span className="block text-xs font-bold text-content-muted sm:hidden">Kept for</span>
                    {row.keptFor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Who sees it ── */}
        <h2 className="mt-12 text-sm font-bold uppercase tracking-widest text-content-muted">Who sees it</h2>
        <ul className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-ink-surface">
          {RECIPIENTS.map((r) => (
            <li key={r.name} className="border-b border-hairline px-5 py-4 last:border-b-0">
              <p className="font-bold text-content-primary">{r.name}</p>
              <p className="mt-1 text-sm text-content-secondary">{r.purpose}</p>
            </li>
          ))}
        </ul>

        {/* ── Delete ── */}
        <h2 className="mt-12 text-sm font-bold uppercase tracking-widest text-content-muted">Delete everything</h2>
        <div className="mt-4 rounded-2xl border border-hairline bg-ink-surface px-5 py-4 text-sm text-content-secondary">
          <p>
            In the app, open Profile and choose Delete account. This removes the account, every log and every
            photo. It cannot be undone.
          </p>
          <p className="mt-3">
            You can also email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand hover:underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            from the address on your account to ask for access to, correction of, or deletion of your data.
          </p>
        </div>

        <p className="mt-10 text-sm text-content-muted">
          The full policy is in the app under Profile, then Privacy policy, and at{' '}
          <a href="/privacy.html" className="font-bold text-content-secondary hover:text-brand">Privacy</a>.{' '}
          <Link to="/" className="font-bold text-content-secondary hover:text-brand">Back to the home page</Link>.
        </p>
      </main>
    </div>
  );
}
