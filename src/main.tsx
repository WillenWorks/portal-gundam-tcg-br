import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cleanPathToHash } from './lib/cleanPathToHash'

const hashTarget = cleanPathToHash(window.location.pathname, window.location.search, window.location.hash)
if (hashTarget) window.history.replaceState(null, '', hashTarget)

// Proteção contra scripts injetados de telemetria / DevTools Live Metrics (ex: web-vitals reportAllChanges lendo 'startTime')
// para evitar que falhas em observadores de performance externos emitam Uncaught TypeError no console.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || (event?.error as Error)?.message || ''
    const stack = (event?.error as Error)?.stack || ''
    if (
      msg.includes("reading 'startTime'") ||
      (msg.includes('startTime') && (stack.includes('reportAllChanges') || stack.includes('<anonymous>')))
    ) {
      event.preventDefault()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
