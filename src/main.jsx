import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import { installApiInterceptors } from './utils/apiInterceptor'
import './index.css'
import App from './App.jsx'

// Install API interceptors to redirect prod URLs to staging/test
// Covers: fetch, XHR (formengine), and axios
// Controlled via VITE_ENVIRONMENT (set per Netlify site):
//   - production  → interceptor skipped (real prod APIs used)
//   - anything else (staging/qa/dev) → interceptor installed
if (import.meta.env.VITE_ENVIRONMENT !== 'production') {
  installApiInterceptors(axios)
} else {
  console.log('[API Interceptor] Skipped (VITE_ENVIRONMENT=production)')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
