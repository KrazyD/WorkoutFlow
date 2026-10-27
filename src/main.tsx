import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import './styles.css'
import { createPwaController } from './features/pwa/pwa-controller'
import { PwaNotifications } from './features/pwa/PwaNotifications'
import { pwaWorkoutGuard } from './db/pwa-workout-guard'

const pwaController = createPwaController(pwaWorkoutGuard, () =>
  window.location.reload(),
)
void pwaController.start(
  import.meta.env.PROD,
  () => import('virtual:pwa-register'),
)

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <PwaNotifications controller={pwaController} />
      <App />
    </BrowserRouter>
  </StrictMode>,
)
