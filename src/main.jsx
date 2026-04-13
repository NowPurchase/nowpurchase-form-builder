import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import { installApiInterceptors } from './utils/apiInterceptor'
import './index.css'
import App from './App.jsx'

// Install API interceptors to redirect prod URLs to staging/test
// Covers: fetch, XHR (formengine), and axios
// Only run outside production so prod builds hit the real prod APIs.
if (import.meta.env.MODE !== 'production') {
  installApiInterceptors(axios)
} else {
  console.log('[API Interceptor] Skipped in production mode')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
