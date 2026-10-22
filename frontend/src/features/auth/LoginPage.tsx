import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import styles from './Auth.module.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Failed to sign in');
    }
  };

  return (
    <div className={styles.authCard}>
      <h1 className={styles.authTitle}>Sign In</h1>
      <p className={styles.authSubtitle}>Access your Sanjivani family health workspace</p>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className={styles.footerText}>
        <p>
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <Link to="/recover-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
