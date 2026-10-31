import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { LoggerService } from './services/loggerService.ts'
import { SpeechService } from './services/speechService.ts'

LoggerService.hydrateFromStorage();
SpeechService.warmUp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Register Service Worker for PWA installation (only on HTTP/HTTPS web, not Electron file://)
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('PWA Service Worker registration skipped or failed:', err);
    });
  });
}
