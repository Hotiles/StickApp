import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import ErrorBoundary from './app/ErrorBoundary.jsx';
import { registerServiceWorker } from './app/appUpdate.js';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Håll webbläsarens/PWA:ns statusfält i samma ton som appens bakgrund
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = darkQuery.matches ? '#211a1e' : '#faf6f2';
}
syncThemeColor();
darkQuery.addEventListener?.('change', syncThemeColor);

// Service worker + uppdateringsflöde (banner när ny version finns)
registerServiceWorker();
