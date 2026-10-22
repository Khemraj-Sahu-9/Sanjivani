/**
 * frontend/src/app/Router.tsx
 *
 * Application route configuration.
 * Configured with Public routes (Home, Login, Register, Password Recovery)
 * and Protected routes (Dashboard, Family Workspace, Patient Profiles).
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.tsx';
import { HomePage } from '../features/home/HomePage.tsx';
import { LoginPage } from '../features/auth/LoginPage.tsx';
import { RegisterPage } from '../features/auth/RegisterPage.tsx';
import { RecoverPasswordPage } from '../features/auth/RecoverPasswordPage.tsx';
import { ProtectedRoute } from '../features/auth/ProtectedRoute.tsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx';
import { useAuth } from '../features/auth/AuthContext.tsx';

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        
        {/* Public authentication routes */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/recover-password" element={<RecoverPasswordPage />} />

        {/* Protected workspace routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404 — Page Not Found</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        This page does not exist or has moved.
      </p>
    </div>
  );
}
