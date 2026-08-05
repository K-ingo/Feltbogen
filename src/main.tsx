import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startOpdateringer } from './opdatering'
import './index.css'
import App from './App.tsx'

// Gør appen installerbar og startbar offline. Findes ingen service worker
// (fx i dev), er kaldet en no-op.
startOpdateringer()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
