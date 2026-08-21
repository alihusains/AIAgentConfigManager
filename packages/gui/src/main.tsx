import React from 'react';
import ReactDOM from 'react-dom/client';
import { getToken } from './api';
import App from './App';
import './index.css';

// The per-launch session token is what authenticates this tab against the
// local API server — but the user doesn't need it cluttering the address bar.
// Capture it now (getToken caches it and persists it to localStorage) and then
// drop the ?t=… query so the URL reads simply http://127.0.0.1:<port>/
if (window.location.search.includes('t=')) {
  getToken();
  window.history.replaceState(null, '', window.location.pathname);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);