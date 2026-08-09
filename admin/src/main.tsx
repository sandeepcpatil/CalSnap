import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { UserDetail } from './pages/UserDetail';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { isConfigured, missingEnv } from './lib/supabase';
import './index.css';

/**
 * Shown instead of a blank page when the build had no Supabase credentials.
 * A white screen plus "supabaseUrl is required" in the console is the least
 * useful way to report a missing environment variable.
 */
function MissingConfig() {
  return (
    <div style={{ maxWidth: 640, margin: '10vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>⚙️ Configuration missing</h1>
      <p style={{ opacity: 0.8 }}>
        This build has no Supabase credentials, so the admin panel can't connect.
        Missing variable{missingEnv.length > 1 ? 's' : ''}:
      </p>
      <ul>
        {missingEnv.map((k) => (
          <li key={k}><code>{k}</code></li>
        ))}
      </ul>
      <p style={{ opacity: 0.8 }}>
        Add {missingEnv.length > 1 ? 'them' : 'it'} in <strong>Vercel → Project → Settings →
        Environment Variables</strong>, then <strong>redeploy</strong>. Vite bakes these in at
        build time, so an existing deployment won't pick them up until it is rebuilt.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  !isConfigured ? (
    <React.StrictMode>
      <MissingConfig />
    </React.StrictMode>
  ) : (
  <React.StrictMode>
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <ProtectedRoute>
              <UserDetail />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
  ),
);
