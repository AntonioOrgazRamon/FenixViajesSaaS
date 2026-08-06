import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './providers/ThemeProvider';
import { AppErrorBoundary } from './components/system/AppErrorBoundary';
import { initAuthStorageSync } from './store/authStore';

initAuthStorageSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
