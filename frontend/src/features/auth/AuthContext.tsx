/**
 * frontend/src/features/auth/AuthContext.tsx
 *
 * Global Authentication Context and Hook.
 * Manages user state, session persistence, login, register, and signout.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, setApiAuthToken, getStoredAuthToken } from '../../lib/apiClient.ts';
import { offlineStorage } from '../../lib/offlineStorage.ts';
import { UserProfile } from '../../types/auth.ts';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, name: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const token = getStoredAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      setApiAuthToken(token);
      const res = await apiClient.get<{ user: UserProfile }>('/api/auth/me');
      if (res.data?.user) {
        setUser(res.data.user);
      } else {
        setApiAuthToken(null);
        setUser(null);
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiClient.post<{ user: UserProfile; token: string }>('/api/auth/login', {
      email,
      password: pass,
    });
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Login failed' };
    }
    setApiAuthToken(res.data.token);
    setUser(res.data.user);
    return { success: true };
  };

  const register = async (email: string, pass: string, name: string, phone?: string) => {
    const res = await apiClient.post<{ user: UserProfile; token: string }>('/api/auth/register', {
      email,
      password: pass,
      fullName: name,
      phone,
    });
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Registration failed' };
    }
    setApiAuthToken(res.data.token);
    setUser(res.data.user);
    return { success: true };
  };

  const logout = () => {
    if (user?.id) {
      offlineStorage.clearUserData(user.id).catch(() => {});
    }
    setApiAuthToken(null);
    setUser(null);
  };

  const requestPasswordReset = async (email: string) => {
    const res = await apiClient.post<{ success: boolean; message: string }>('/api/auth/recover-password', {
      email,
    });
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Password reset request failed' };
    }
    return { success: true, message: res.data.message };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
