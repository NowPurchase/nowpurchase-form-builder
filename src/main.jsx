import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'np-dlms-components/styles.css'
import './config/rsCameraCaptureOverrides.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
