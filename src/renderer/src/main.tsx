import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import { App } from './App'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { initVideoManager } from './media/VideoManager'
import { initImageManager } from './media/ImageManager'
import { initShaderManager } from './media/ShaderManager'
import { initAudioManager } from './media/AudioManager'
import { initMidiManager } from './media/MidiManager'
import { initKeyboardManager } from './media/KeyboardManager'
import './styles.css'

window.addEventListener('error', (event) => {
  console.error('[editor]', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[editor] unhandled rejection', event.reason)
})

initVideoManager()
initImageManager()
initShaderManager()
initAudioManager()
initMidiManager()
initKeyboardManager()

const root = document.getElementById('root')
if (root === null) throw new Error('#root element missing')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary label="PixelForge crashed">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
