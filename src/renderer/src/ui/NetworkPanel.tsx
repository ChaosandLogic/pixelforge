import { useEffect } from 'react'
import { useEngineStore } from '@/store/engineStore'

export function NetworkPanel(): React.JSX.Element {
  const interfaces = useEngineStore((s) => s.interfaces)
  const config = useEngineStore((s) => s.config)
  const loadInterfaces = useEngineStore((s) => s.loadInterfaces)
  const updateConfig = useEngineStore((s) => s.updateConfig)

  useEffect(() => {
    void loadInterfaces()
  }, [loadInterfaces])

  return (
    <aside className="network-panel">
      <div className="panel-header">
        <h2>Network</h2>
        <button className="refresh-btn" onClick={() => void loadInterfaces()} title="Rescan interfaces">
          ↻
        </button>
      </div>

      <p className="panel-hint">
        Output interface (sACN, Art-Net, DDP). On macOS, allow Local Network access when prompted, or pick
        your LAN adapter here.
      </p>

      <label className="iface-option">
        <input
          type="radio"
          name="iface"
          checked={config.iface === null}
          onChange={() => updateConfig({ iface: null })}
        />
        <div>
          <span className="iface-name">System default</span>
          <span className="iface-addr">Let the OS choose</span>
        </div>
      </label>

      {interfaces
        .filter((i) => !i.internal)
        .map((iface) => (
          <label key={`${iface.name}-${iface.address}`} className="iface-option">
            <input
              type="radio"
              name="iface"
              checked={config.iface === iface.address}
              onChange={() => updateConfig({ iface: iface.address })}
            />
            <div>
              <span className="iface-name">{iface.name}</span>
              <span className="iface-addr">{iface.address}</span>
            </div>
          </label>
        ))}
    </aside>
  )
}
