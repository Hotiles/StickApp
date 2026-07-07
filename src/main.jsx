import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import ErrorBoundary from './app/ErrorBoundary.jsx';
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

// Service worker: bara i produktion (stör utvecklingsläget annars)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
