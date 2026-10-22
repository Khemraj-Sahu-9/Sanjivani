/**
 * frontend/src/features/home/HomePage.test.tsx
 *
 * Tests for the HomePage component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage.tsx';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('HomePage', () => {
  it('renders the application title', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Sanjivani')).toBeInTheDocument();
  });

  it('shows the platform badge', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/AI Health Memory Platform/i)).toBeInTheDocument();
  });

  it('shows system operational status section', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('System Operational Status')).toBeInTheDocument();
  });

  it('shows the family workspace as operational', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Web Application & Family Workspace')).toBeInTheDocument();
  });

  it('shows the complete platform capabilities section', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Complete Platform Capabilities')).toBeInTheDocument();
  });

  it('renders sign in and registration call to actions', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/Sign In to Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Account/i)).toBeInTheDocument();
  });
});
