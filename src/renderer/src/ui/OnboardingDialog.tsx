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
    const { loadProject } = await import('@/project/projectActions')
    const project = await window.pixelforge.openExample('01-scrolling-wave.pxf')
    if (project !== null) {
      loadProject(project)
    }
    dismiss()
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>Welcome to PixelForge</h2>
        <p>
          Start with the scrolling wave tutorial, or use <strong>File → Open</strong> and{' '}
          <strong>Examples ▾</strong> in the toolbar for more demo patches.
        </p>
        <ul>
          <li>Build or import a patch from <strong>Patch</strong> next to Add node (layout builder, CSV, or JSON)</li>
          <li>Wire generators into a <strong>Pixel Output</strong> node and pick sACN, Art-Net, or DDP</li>
          <li>Choose <strong>Send from</strong> on Pixel Output if you need a specific NIC, then toggle <strong>Output ON</strong></li>
          <li>Use the 3D tab to preview live colours on your layout</li>
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
