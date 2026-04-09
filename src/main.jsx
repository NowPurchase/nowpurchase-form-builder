import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import { installApiInterceptors } from './utils/apiInterceptor'
import './index.css'
import App from './App.jsx'

// Install API interceptors to redirect prod URLs to staging/test
// Covers: fetch, XHR (formengine), and axios
installApiInterceptors(axios)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
