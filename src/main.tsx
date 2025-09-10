import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app.css'
import App from './App.tsx'

// Initialize global error handling in production only
if (import.meta.env.PROD) {
  await import('./utils/errorReporting');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
