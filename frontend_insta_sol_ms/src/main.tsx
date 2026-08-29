import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { captureTokenFromUrl } from './api/client';
import './index.css';

// Runs before the first render: if the CRM redirected here with `?token=`,
// store it and scrub it out of the address bar so no live JWT survives in the
// URL, history, or a copied link.
captureTokenFromUrl();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
