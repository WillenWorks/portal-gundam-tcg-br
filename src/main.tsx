import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { legacyHashToPath } from './lib/legacyHashRoute'
import { initAnalytics } from './lib/analytics'
import { initErrorMonitoring } from './lib/errorMonitoring'

// Links antigos com hash (`/#/cards/abc`) viram o caminho limpo equivalente antes do roteador montar.
const legacyTarget = legacyHashToPath(window.location.pathname, window.location.search, window.location.hash)
if (legacyTarget) window.history.replaceState(null, '', legacyTarget)
initAnalytics()
initErrorMonitoring()

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
