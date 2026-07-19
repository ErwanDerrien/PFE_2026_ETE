import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@astryxdesign/core/theme'
import { gothicTheme } from '@astryxdesign/theme-gothic/built'
import './index.css'
import App from './shell/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={gothicTheme} mode="dark">
      <App />
    </Theme>
  </StrictMode>,
)
