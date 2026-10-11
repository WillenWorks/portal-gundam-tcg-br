import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cleanPathToHash } from './lib/cleanPathToHash'

const hashTarget = cleanPathToHash(window.location.pathname, window.location.search, window.location.hash)
if (hashTarget) window.history.replaceState(null, '', hashTarget)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
