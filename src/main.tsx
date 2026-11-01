import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
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

// Pedaço de página (lazy) que não baixou — rede instável ou aba aberta de uma versão bem antiga: recarrega a
// página uma vez (a guarda na sessão evita laço se o arquivo não existir mesmo; aí o erro segue pro Sentry).
if (typeof window !== 'undefined') {
  const KEY = 'anaheimhub:chunk-reload'
  window.addEventListener('vite:preloadError', () => {
    try {
      if (sessionStorage.getItem(KEY)) return
      sessionStorage.setItem(KEY, '1')
    } catch {
      return // sem sessionStorage não dá pra garantir que recarrega uma vez só
    }
    window.location.reload()
  })
  // carregou certo: libera um novo recarregamento numa próxima falha
  window.addEventListener('load', () =>
    window.setTimeout(() => {
      try { sessionStorage.removeItem(KEY) } catch { /* sem storage */ }
    }, 10_000),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
