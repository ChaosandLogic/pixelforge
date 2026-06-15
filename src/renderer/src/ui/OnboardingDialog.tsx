import { useEffect, useState } from 'react'

export function OnboardingDialog(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void window.pixelforge.getOnboardingSeen().then((seen) => {
      if (!seen) setOpen(true)
    })
  }, [])

  if (!open) return null

  const dismiss = (): void => {
    void window.pixelforge.setOnboardingSeen()
    setOpen(false)
  }

  const loadTutorial = async (): Promise<void> => {
    const project = await window.pixelforge.openExample('01-scrolling-wave.pxf')
    if (project !== null) {
      const { loadProjectIntoStores } = await import('@/project/loadProject')
      loadProjectIntoStores(project)
    }
    dismiss()
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>Welcome to PixelForge</h2>
        <p>
          Start with the scrolling wave tutorial, or open <strong>Examples ▾</strong> from the toolbar for more
          demo patches.
        </p>
        <ul>
          <li>Pick a network interface in the left panel</li>
          <li>Toggle <strong>Output ON</strong> to send sACN to your fixtures</li>
          <li>Use the 3D tab to preview on your patch layout</li>
        </ul>
        <div className="onboarding-actions">
          <button className="tool-btn primary" onClick={() => void loadTutorial()}>
            Load tutorial
          </button>
          <button className="tool-btn" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
