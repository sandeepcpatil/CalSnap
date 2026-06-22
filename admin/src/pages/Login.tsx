import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-teal to-teal-dark p-12 text-white">
        <div className="text-3xl font-black tracking-tight">🥗 CalSnap</div>
        <div>
          <blockquote className="text-2xl font-semibold leading-snug opacity-90">
            "Snap your food.<br />Know your nutrition."
          </blockquote>
          <p className="mt-4 text-sm opacity-60">Admin dashboard · v1.0</p>
        </div>
        <div className="flex gap-3">
          {['Total Users', 'Pro Subscribers', 'Daily Scans'].map(s => (
            <div key={s} className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-xs opacity-70">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <div className="text-4xl mb-3 lg:hidden">🥗</div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to your admin account</p>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <span className="text-red-500 text-sm font-medium">{error}</span>
              </div>
            )}

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white rounded-xl font-bold text-base hover:border-teal hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-teal rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Only authorised admin accounts can access this dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
