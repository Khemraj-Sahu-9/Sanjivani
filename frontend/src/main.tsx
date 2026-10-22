/**
 * frontend/src/main.tsx
 *
 * Application entry point.
 * Mounts the React application into the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.tsx';
import './styles/variables.css';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. The HTML must contain a <div id="root">.</div>'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for Phase 7 Offline Application Shell
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors during local automated testing / dev
    });
  });
}

