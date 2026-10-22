/**
 * frontend/src/features/auth/AuthFlow.test.tsx
 *
 * Automated tests for Phase 1 Frontend:
 * - Login form rendering & interaction
 * - Register form rendering & validation
 * - Password recovery rendering
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './AuthContext.tsx';
import { LoginPage } from './LoginPage.tsx';
import { RegisterPage } from './RegisterPage.tsx';
import { RecoverPasswordPage } from './RecoverPasswordPage.tsx';

describe('Phase 1 Frontend Authentication Forms', () => {
  it('renders login form elements properly', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register here/i })).toBeInTheDocument();
  });

  it('renders registration form elements properly', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('renders password recovery form properly', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RecoverPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send recovery instructions/i })).toBeInTheDocument();
  });
});
