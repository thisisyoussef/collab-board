import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { logger } from './lib/logger';
import './index.css';

logger.info('AUTH', 'CollabBoard app started', {
  environment: import.meta.env.MODE,
  url: window.location.href,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
