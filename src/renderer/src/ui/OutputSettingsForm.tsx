import { useEffect, useRef, useState } from 'react'
import { isOutputTransmitEnabled, OUTPUT_PROTOCOL_LABELS, type OutputProtocolKind } from '@shared/output/config'
import {
  COLOR_MODE_LABELS,
  COLOR_MODES,
  WHITE_MODE_LABELS,
  WHITE_MODES,
  parseColorMode,
  parseWhiteMode,
  pixelsPerUniverse,
  type ColorMode,
  type WhiteMode
} from '@shared/output/rgbw'
import { useEngineStore } from '@/store/engineStore'
import { useGraphStore } from '@/store/graphStore'

const PROTOCOL_OPTIONS: OutputProtocolKind[] = ['sacn', 'artnet', 'ddp']
const CUSTOM_HOST = '__custom__'

interface OutputSettingsFormProps {
  nodeId: string
  /** Show the per-route transmit toggle (default on). */
  showTransmit?: boolean
  /** Bind NIC picker. Editor Pixel Output node only — Player keeps NetworkPanel. */
  showBindInterface?: boolean
}

export function OutputSettingsForm({
  nodeId,
  showTransmit = true,
  showBindInterface = false
}: OutputSettingsFormProps): React.JSX.Element {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateParam = useGraphStore((s) => s.updateParam)
  const interfaces = useEngineStore((s) => s.interfaces)
  const loadInterfaces = useEngineStore((s) => s.loadInterfaces)
  const config = useEngineStore((s) => s.config)
  const updateConfig = useEngineStore((s) => s.updateConfig)

  useEffect(() => {
    void loadInterfaces()
  }, [loadInterfaces])

  const params = node?.data.params ?? {}
  const sacnHost = typeof params['sacnHost'] === 'string' ? params['sacnHost'] : ''
  const adapters = interfaces.filter((i) => !i.internal)
  const sacnHostInAdapters = adapters.some((i) => i.address === sacnHost)

  // Ref avoids useEffect/setState loops when adapters load; bump version only on user menu choice.
  const forceCustomRef = useRef(false)
  const [customMenuVersion, setCustomMenuVersion] = useState(0)
  void customMenuVersion

  if (sacnHostInAdapters) forceCustomRef.current = false

  const showCustomSacnInput =
    forceCustomRef.current || (sacnHost !== '' && !sacnHostInAdapters)
  const sacnSelectValue = showCustomSacnInput ? CUSTOM_HOST : sacnHost

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
  const colorMode = parseColorMode(params['colorMode'])
  const whiteMode = parseWhiteMode(params['whiteMode'])
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

      {showBindInterface && (
        <>
          <label className="output-field">
            <span className="output-field-label-row">
              Send from
              <button
                type="button"
                className="refresh-btn"
                title="Rescan interfaces"
                onClick={() => void loadInterfaces()}
              >
                ↻
              </button>
            </span>
            <select
              value={config.iface ?? ''}
              onChange={(e) => updateConfig({ iface: e.target.value === '' ? null : e.target.value })}
            >
              <option value="">System default</option>
              {adapters.map((iface) => (
                <option key={`${iface.name}-${iface.address}`} value={iface.address}>
                  {iface.name} ({iface.address})
                </option>
              ))}
              {config.iface !== null &&
                config.iface !== '' &&
                !adapters.some((iface) => iface.address === config.iface) && (
                  <option value={config.iface}>{config.iface} (unavailable)</option>
                )}
            </select>
          </label>
          <p className="output-field-hint">
            Local adapter to send from. Destination is Fixture IP / Host below, not this NIC.
          </p>
        </>
      )}

      {protocol === 'sacn' && (
        <>
          <label className="output-field">
            <span>Fixture IP (optional)</span>
            <select
              value={sacnSelectValue}
              onChange={(e) => {
                const value = e.target.value
                if (value === CUSTOM_HOST) {
                  forceCustomRef.current = true
                  setCustomMenuVersion((v) => v + 1)
                  return
                }
                forceCustomRef.current = false
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

      <label className="output-field">
        <span>Colour mode</span>
        <select
          value={colorMode}
          onChange={(e) => updateParam(nodeId, 'colorMode', e.target.value as ColorMode)}
        >
          {COLOR_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {COLOR_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {colorMode === 'rgbw' && (
        <label className="output-field">
          <span>White channel</span>
          <select
            value={whiteMode}
            onChange={(e) => updateParam(nodeId, 'whiteMode', e.target.value as WhiteMode)}
          >
            {WHITE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {WHITE_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="output-field-hint">
        {colorMode === 'rgbw'
          ? `RGBW derives W at output (${pixelsPerUniverse('rgbw')} pixels / universe). Subtractive moves shared white into W; luminance adds W from brightness.`
          : `${pixelsPerUniverse('rgb')} RGB pixels per sACN/Art-Net universe.`}
      </p>

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
