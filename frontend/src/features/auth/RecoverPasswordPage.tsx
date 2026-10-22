import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import styles from './Auth.module.css';

export function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.success) {
      setMessage(result.message || 'If an account exists, a recovery link has been dispatched.');
    } else {
      setError(result.error || 'Failed to request password reset');
    }
  };

  return (
    <div className={styles.authCard}>
      <h1 className={styles.authTitle}>Reset Password</h1>
      <p className={styles.authSubtitle}>Enter your registered email address to receive recovery instructions</p>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {message && <div className={styles.successBanner}>{message}</div>}

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

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? 'Sending...' : 'Send Recovery Instructions'}
        </button>
      </form>

      <div className={styles.footerText}>
        <p>
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
