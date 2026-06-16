import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

interface Stats {
  totalUsers: number;
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  totalProSubscribers: number;
  monthlyRevenuePaise: number;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  scan_count: number;
  is_subscribed: boolean;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden relative">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accent }} />
      )}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 mt-1">{label}</p>
      <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2 font-medium">{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [signupChart, setSignupChart] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [scanChart, setScanChart] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  useEffect(() => {
    fetchStats();
    fetchSignups();
    fetchScans();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchStats = async () => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { data: today },
      { data: week },
      { data: month },
      { data: subs },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('food_logs').select('user_id').gte('logged_at', last24h),
      supabase.from('food_logs').select('user_id').gte('logged_at', last7d),
      supabase.from('food_logs').select('user_id').gte('logged_at', last30d),
      supabase.from('subscriptions').select('plan').eq('status', 'active'),
    ]);

    const monthlySubs = subs?.filter(s => s.plan === 'monthly').length ?? 0;
    const annualSubs = subs?.filter(s => s.plan === 'annual').length ?? 0;

    setStats({
      totalUsers: totalUsers ?? 0,
      activeToday: new Set(today?.map(r => r.user_id)).size,
      activeThisWeek: new Set(week?.map(r => r.user_id)).size,
      activeThisMonth: new Set(month?.map(r => r.user_id)).size,
      totalProSubscribers: (subs?.length ?? 0),
      monthlyRevenuePaise: monthlySubs * 150 + annualSubs * 100,
    });
    setLoading(false);
  };

  const fetchSignups = async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('profiles').select('created_at').gte('created_at', since);

    const buckets: Record<string, number> = {};
    data?.forEach(row => {
      const day = row.created_at.slice(5, 10); // MM-DD
      buckets[day] = (buckets[day] || 0) + 1;
    });

    const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    setSignupChart({ labels: sorted.map(([k]) => k), data: sorted.map(([, v]) => v) });
  };

  const fetchScans = async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('food_logs').select('logged_at').gte('logged_at', since);

    const buckets: Record<string, number> = {};
    data?.forEach(row => {
      const day = row.logged_at.slice(5, 10);
      buckets[day] = (buckets[day] || 0) + 1;
    });

    const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    setScanChart({ labels: sorted.map(([k]) => k), data: sorted.map(([, v]) => v) });
  };

  const fetchUsers = async () => {
    const offset = (page - 1) * LIMIT;
    let query = supabase
      .from('profiles')
      .select('id, name, email, created_at, scan_count, is_subscribed', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + LIMIT - 1);

    if (search) query = query.ilike('email', `%${search}%`);

    const { data, count } = await query;
    setUsers(data ?? []);
    setTotal(count ?? 0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥗</span>
          <h1 className="text-xl font-bold text-teal">CalSnap Admin</h1>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-red-500 transition-colors">
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Total Users" value={stats?.totalUsers.toLocaleString() ?? '—'} accent="linear-gradient(90deg,#01696f,#029aa3)" />
          <KpiCard label="Active Today" value={stats?.activeToday ?? '—'} accent="#4caf50" />
          <KpiCard label="Active This Week" value={stats?.activeThisWeek ?? '—'} accent="#ff9800" />
          <KpiCard label="Active This Month" value={stats?.activeThisMonth ?? '—'} accent="#5c6bc0" />
          <KpiCard label="Pro Subscribers" value={stats?.totalProSubscribers ?? '—'} accent="#ab47bc" />
          <KpiCard
            label="Monthly Revenue"
            value={`₹${(stats?.monthlyRevenuePaise ?? 0).toLocaleString('en-IN')}`}
            sub="estimated"
            accent="linear-gradient(90deg,#f59e0b,#ef5350)"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              New Signups (30 days)
            </h2>
            <Bar
              data={{
                labels: signupChart.labels,
                datasets: [{ data: signupChart.data, backgroundColor: '#01696f', borderRadius: 4 }],
              }}
              options={chartOptions}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Daily Scans (30 days)
            </h2>
            <Line
              data={{
                labels: scanChart.labels,
                datasets: [{
                  data: scanChart.data,
                  borderColor: '#01696f',
                  backgroundColor: 'rgba(1,105,111,0.1)',
                  fill: true,
                  tension: 0.4,
                }],
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex-1">Users</h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email…"
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal outline-none"
              />
              <button type="submit" className="px-3 py-1.5 text-sm bg-teal text-white rounded-lg hover:bg-teal-dark transition-colors">
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Name', 'Email', 'Joined', 'Scans', 'Plan'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <Link to={`/users/${user.id}`} className="text-teal hover:underline">
                        {user.name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{user.email ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">{user.scan_count}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.is_subscribed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {user.is_subscribed ? 'Pro' : 'Free'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * LIMIT >= total}
                className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
