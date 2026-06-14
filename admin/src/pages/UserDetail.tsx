import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  scan_count: number;
  is_subscribed: boolean;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  body_goal: string | null;
  daily_calorie_goal: number | null;
}

interface FoodLog {
  id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string | null;
  logged_at: string;
  image_url: string | null;
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      setProfile(data);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const offset = (page - 1) * LIMIT;
    supabase
      .from('food_logs')
      .select('id, food_name, calories, protein_g, carbs_g, fat_g, meal_type, logged_at, image_url', { count: 'exact' })
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .range(offset, offset + LIMIT - 1)
      .then(({ data, count }) => {
        setLogs(data ?? []);
        setTotal(count ?? 0);
      });
  }, [userId, page]);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-teal hover:underline text-sm">← Back to Dashboard</Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-teal">User Detail</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Profile card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">{profile.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</p>
            <p className="text-base text-gray-700 dark:text-gray-300 mt-1">{profile.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</p>
            <p className="mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${profile.is_subscribed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {profile.is_subscribed ? 'Pro' : 'Free'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Scans</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">{profile.scan_count}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Weight</p>
            <p className="text-base text-gray-700 dark:text-gray-300 mt-1">{profile.weight_kg ? `${profile.weight_kg} kg` : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Height</p>
            <p className="text-base text-gray-700 dark:text-gray-300 mt-1">{profile.height_cm ? `${profile.height_cm} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Goal</p>
            <p className="text-base text-gray-700 dark:text-gray-300 mt-1 capitalize">{profile.body_goal?.replace('_', ' ') ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Calorie Target</p>
            <p className="text-base text-gray-700 dark:text-gray-300 mt-1">{profile.daily_calorie_goal ? `${profile.daily_calorie_goal} kcal` : '—'}</p>
          </div>
        </div>

        {/* Food log table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Food Log History ({total})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Food', 'Calories', 'Protein', 'Carbs', 'Fat', 'Meal', 'Logged At'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-5 py-3 font-medium max-w-[200px] truncate">{log.food_name}</td>
                    <td className="px-5 py-3">{log.calories}</td>
                    <td className="px-5 py-3">{Math.round(log.protein_g)}g</td>
                    <td className="px-5 py-3">{Math.round(log.carbs_g)}g</td>
                    <td className="px-5 py-3">{Math.round(log.fat_g)}g</td>
                    <td className="px-5 py-3 capitalize">{log.meal_type ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(log.logged_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total} className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
