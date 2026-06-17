import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { PlayerApp } from './PlayerApp'
import { initVideoManager } from '../media/VideoManager'
import { initImageManager } from '../media/ImageManager'
import { initAudioManager } from '../media/AudioManager'
import { initMidiManager } from '../media/MidiManager'
import { initKeyboardManager } from '../media/KeyboardManager'
import '../styles.css'

function showBootError(message: string): void {
  const root = document.getElementById('root')
  if (root === null) return
  root.innerHTML = `<div class="error-fallback"><h1>PixelForge Player failed to start</h1><pre>${message}</pre></div>`
}

window.addEventListener('error', (event) => {
  console.error('[player]', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[player] unhandled rejection', event.reason)
})

const root = document.getElementById('root')
if (root === null) throw new Error('#root element missing')

try {
  ReactDOM.createRoot(root).render(
    <ErrorBoundary label="PixelForge Player crashed">
      <PlayerApp />
    </ErrorBoundary>
  )
} catch (err) {
  showBootError(err instanceof Error ? err.message : String(err))
  throw err
}

queueMicrotask(() => {
  try {
    initVideoManager()
    initImageManager()
    initAudioManager()
    initMidiManager()
    initKeyboardManager()
  } catch (err) {
    console.error('[player] media init failed', err)
  }
})
