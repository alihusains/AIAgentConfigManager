import React from 'react';
import ReactDOM from 'react-dom/client';
import { getToken } from './api';
import App from './App';
import './index.css';

// The per-launch session token is what authenticates this tab against the
// local API server. It is injected into index.html by the config server, and
// legacy ?t=… links are honored too — either way resolve it once now so the
// first API call is ready and the URL stays clean.
getToken();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
