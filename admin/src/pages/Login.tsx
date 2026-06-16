import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/');
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <span className="text-red-500 text-sm font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal text-white rounded-xl font-bold text-base hover:bg-teal-dark active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-teal/25"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
