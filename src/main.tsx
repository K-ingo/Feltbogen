import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { startOpdateringer } from './opdatering'
import { Indlaeser } from './ui'
import './index.css'
import App from './App.tsx'

// Gør appen installerbar og startbar offline. Findes ingen service worker
// (fx i dev), er kaldet en no-op.
startOpdateringer()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Skallen hører til inde i den enkelte skærm, så der er ikke noget at
        holde stående mens en sjælden skærm hentes. Ventetiden gælder kun
        første gang: derefter ligger stykket i service workerens cache som
        resten af appen. */}
    <Suspense fallback={<Indlaeser />}>
      <App />
    </Suspense>
  </StrictMode>,
)
