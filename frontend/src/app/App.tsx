/**
 * frontend/src/app/App.tsx
 *
 * Root application component.
 * Configures AuthProvider and BrowserRouter.
 */

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext.tsx';
import { AppRouter } from './Router.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
