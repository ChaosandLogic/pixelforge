import { useEffect, useState } from 'react'
import { isOutputTransmitEnabled, OUTPUT_PROTOCOL_LABELS, type OutputProtocolKind } from '@shared/output/config'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'

const PROTOCOL_OPTIONS: OutputProtocolKind[] = ['sacn', 'artnet', 'ddp']
const CUSTOM_HOST = '__custom__'

interface OutputSettingsFormProps {
  nodeId: string
  /** Show the per-route transmit toggle (default on). */
  showTransmit?: boolean
}

export function OutputSettingsForm({
  nodeId,
  showTransmit = true
}: OutputSettingsFormProps): React.JSX.Element {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateParam = useGraphStore((s) => s.updateParam)
  const interfaces = useEngineStore((s) => s.interfaces)

  const params = node?.data.params ?? {}
  const sacnHost = typeof params['sacnHost'] === 'string' ? params['sacnHost'] : ''
  const adapters = interfaces.filter((i) => !i.internal)
  const sacnHostInAdapters = adapters.some((i) => i.address === sacnHost)
  const [pickCustomIp, setPickCustomIp] = useState(false)

  // Derive custom-IP UI; only track explicit "Custom IP…" menu choice in state.
  const needsCustomInput = sacnHost !== '' && !sacnHostInAdapters
  const showCustomSacnInput = pickCustomIp || needsCustomInput
  const sacnSelectValue = showCustomSacnInput ? CUSTOM_HOST : sacnHost

  useEffect(() => {
    if (sacnHostInAdapters) setPickCustomIp(false)
  }, [sacnHostInAdapters])

  if (node === undefined) {
    return <p className="panel-hint">Output node not found.</p>
  }

  const protocol =
    params['protocol'] === 'artnet' || params['protocol'] === 'ddp'
      ? (params['protocol'] as OutputProtocolKind)
      : 'sacn'
  const startUniverse = typeof params['startUniverse'] === 'number' ? params['startUniverse'] : 1
  const sacnMulticast = `239.255.${startUniverse >> 8}.${startUniverse & 255}`
  const ddpHost = typeof params['ddpHost'] === 'string' ? params['ddpHost'] : '255.255.255.255'
  const ddpPort = typeof params['ddpPort'] === 'number' ? params['ddpPort'] : 4048
  const transmitOn = isOutputTransmitEnabled(params)

  return (
    <div className="output-settings-form">
      {showTransmit && (
        <label className="output-field output-field-row">
          <span>Transmit</span>
          <button
            type="button"
            className={transmitOn ? 'tool-btn active' : 'tool-btn'}
            onClick={() => updateParam(nodeId, 'transmit', !transmitOn)}
          >
            {transmitOn ? 'On' : 'Off'}
          </button>
        </label>
      )}

      <label className="output-field">
        <span>Protocol</span>
        <select value={protocol} onChange={(e) => updateParam(nodeId, 'protocol', e.target.value)}>
          {PROTOCOL_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {OUTPUT_PROTOCOL_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      {protocol === 'sacn' && (
        <>
          <label className="output-field">
            <span>Fixture IP (optional)</span>
            <select
              value={sacnSelectValue}
              onChange={(e) => {
                const value = e.target.value
                if (value === CUSTOM_HOST) {
                  setPickCustomIp(true)
                  return
                }
                setPickCustomIp(false)
                updateParam(nodeId, 'sacnHost', value)
              }}
            >
              <option value="">Multicast ({sacnMulticast})</option>
              {adapters.map((iface) => (
                <option key={`${iface.name}-${iface.address}`} value={iface.address}>
                  {iface.address} ({iface.name})
                </option>
              ))}
              <option value={CUSTOM_HOST}>Custom IP…</option>
            </select>
          </label>
          {showCustomSacnInput && (
            <label className="output-field">
              <span>Custom fixture IP</span>
              <input
                type="text"
                value={sacnHost}
                onChange={(e) => updateParam(nodeId, 'sacnHost', e.target.value)}
                placeholder="192.168.0.100"
              />
            </label>
          )}
          <p className="output-field-hint">
            Multicast is standard sACN (U{startUniverse} → {sacnMulticast}). Pick an adapter IP for unicast,
            or enter a fixture address under Custom IP.
          </p>
        </>
      )}

      {(protocol === 'sacn' || protocol === 'artnet') && (
        <label className="output-field">
          <span>Start universe</span>
          <input
            type="number"
            min={1}
            max={63999}
            value={startUniverse}
            onChange={(e) => updateParam(nodeId, 'startUniverse', Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      )}

      {protocol === 'ddp' && (
        <>
          <label className="output-field">
            <span>Host</span>
            <input
              type="text"
              value={ddpHost}
              onChange={(e) => updateParam(nodeId, 'ddpHost', e.target.value)}
              placeholder="255.255.255.255"
            />
          </label>
          <label className="output-field">
            <span>Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={ddpPort}
              onChange={(e) => updateParam(nodeId, 'ddpPort', Math.max(1, Number(e.target.value) || 4048))}
            />
          </label>
        </>
      )}
    </div>
  )
}
