import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import { App } from './App'
import { initVideoManager } from './media/VideoManager'
import { initImageManager } from './media/ImageManager'
import { initAudioManager } from './media/AudioManager'
import { initMidiManager } from './media/MidiManager'
import './styles.css'

initVideoManager()
initImageManager()
initAudioManager()
initMidiManager()

const root = document.getElementById('root')
if (root === null) throw new Error('#root element missing')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
