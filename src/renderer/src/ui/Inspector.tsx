import { useMemo } from 'react'
import { getNodeType } from '@shared/graph/registry'
import { AUDIO_IN_INLINE_PARAMS } from '@shared/graph/nodes/audio/AudioIn'
import { IMAGE_INLINE_PARAMS } from '@shared/graph/nodes/generators/ImageFile'
import { VIDEO_INLINE_PARAMS } from '@shared/graph/nodes/generators/VideoFile'
import { OUTPUT_INLINE_PARAMS } from '@shared/graph/nodes/output/PixelOutput'
import { SYPHON_IN_INLINE_PARAMS } from '@shared/graph/nodes/generators/SyphonIn'
import { SYPHON_OUT_INLINE_PARAMS } from '@shared/graph/nodes/output/SyphonOut'
import { KEYBOARD_INLINE_PARAMS, KEYBOARD_IN_NODE_TYPE } from '@shared/graph/nodes/input/KeyboardIn'
import { FIXTURE_INLINE_PARAMS } from '@shared/graph/nodes/setup/Fixture'
import { KeyboardInspectorPanel } from '@/ui/KeyboardInspectorPanel'
import { GRADIENT_NODE_TYPE } from '@shared/graph/nodes/generators/Gradient'
import { parseGradientStops } from '@shared/colour/gradientStops'
import {
  bindingKey,
  formatBindingRef,
  listFloatSources
} from '@shared/graph/paramBinding'
import type { NodeData, ParamBinding, ParamDef, ParamValue } from '@shared/graph/types'
import { hexToRgb, rgbToHex } from '@/lib/colour'
import { useGraphStore } from '@/store/graphStore'
import { useEngineStore } from '@/store/engineStore'
import { useUiStore } from '@/store/uiStore'
import { formatEvalMs } from '@/graph/components/NodeProfilerBadge'
import { GradientEditor } from '@/ui/GradientEditor'
function ParamControl({
  def,
  value,
  disabled,
  onChange
}: {
  def: ParamDef
  value: ParamValue
  disabled?: boolean
  onChange: (value: ParamValue) => void
}): React.JSX.Element {
  switch (def.type) {
    case 'float':
      return (
        <div className="param-slider">
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step ?? 0.01}
            value={typeof value === 'number' ? value : def.default}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="param-value">{(typeof value === 'number' ? value : def.default).toFixed(2)}</span>
        </div>
      )
    case 'int':
      return (
        <input
          type="number"
          min={def.min}
          max={def.max}
          step={1}
          value={typeof value === 'number' ? value : def.default}
          disabled={disabled}
          onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        />
      )
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={typeof value === 'boolean' ? value : def.default}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      )
    case 'colour':
      return (
        <input
          type="color"
          value={rgbToHex(typeof value === 'object' && value !== null && 'r' in value ? value : def.default)}
          disabled={disabled}
          onChange={(e) => onChange(hexToRgb(e.target.value))}
        />
      )
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : def.default}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'string':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : def.default}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'segments':
      return <></>
    case 'gradient-stops':
      return <></>
    case 'schedule':
      return <></>
    case 'component':
      return <></>
    case 'file': {
      const path = typeof value === 'string' ? value : ''
      const filename = path === '' ? 'No file' : (path.split('/').pop() ?? path)
      return (
        <button
          className="file-btn"
          title={path === '' ? 'Choose a file' : path}
          disabled={disabled}
          onClick={() => {
            void window.pixelforge.pickVideoFile().then((picked) => {
              if (picked !== null) onChange(picked)
            })
          }}
        >
          {filename}
        </button>
      )
    }
  }
}

function ParamBindingSelect({
  nodeId,
  paramName,
  binding,
  graphNodes
}: {
  nodeId: string
  paramName: string
  binding: ParamBinding | undefined
  graphNodes: NodeData[]
}): React.JSX.Element {
  const setParamBinding = useGraphStore((s) => s.setParamBinding)
  const sources = useMemo(() => listFloatSources(graphNodes, nodeId), [graphNodes, nodeId])

  return (
    <select
      className="param-bind-select"
      value={binding !== undefined ? bindingKey(binding) : ''}
      title="Drive this parameter from another node's float output"
      onChange={(e) => {
        const err = setParamBinding(nodeId, paramName, e.target.value)
        if (err !== null) window.alert(err)
      }}
    >
      <option value="">Static value</option>
      {sources.map((src) => {
        const key = bindingKey({ fromNode: src.nodeId, fromPort: src.port })
        return (
          <option key={key} value={key}>
            {src.nodeLabel} · {src.portLabel}
          </option>
        )
      })}
    </select>
  )
}

function ParamRow({
  nodeId,
  def,
  value,
  binding,
  graphNodes
}: {
  nodeId: string
  def: ParamDef
  value: ParamValue
  binding: ParamBinding | undefined
  graphNodes: NodeData[]
}): React.JSX.Element {
  const updateParam = useGraphStore((s) => s.updateParam)
  const bindable = def.type === 'float' || def.type === 'int'

  return (
    <div className={`param-block${binding !== undefined ? ' param-bound' : ''}`}>
      <div className="param-row">
        <label>{def.label}</label>
        {!bindable ? (
          <ParamControl def={def} value={value} onChange={(v) => updateParam(nodeId, def.name, v)} />
        ) : binding !== undefined ? (
          <span className="param-bound-badge">linked</span>
        ) : (
          <ParamControl def={def} value={value} onChange={(v) => updateParam(nodeId, def.name, v)} />
        )}
      </div>
      {bindable && (
        <>
          <ParamBindingSelect
            nodeId={nodeId}
            paramName={def.name}
            binding={binding}
            graphNodes={graphNodes}
          />
          {binding !== undefined && (
            <p className="param-bound-ref">{formatBindingRef(graphNodes, binding)}</p>
          )}
        </>
      )}
    </div>
  )
}

function ProfilerPanel(): React.JSX.Element | null {
  const enabled = useUiStore((s) => s.profilerEnabled)
  const nodes = useGraphStore((s) => s.nodes)
  const nodeTimings = useEngineStore((s) => s.nodeTimings)

  if (!enabled) return null

  const ranked = nodes
    .map((n) => ({ id: n.id, label: getNodeType(n.data.nodeType)?.label ?? n.data.nodeType, ms: nodeTimings[n.id] }))
    .filter((e): e is { id: string; label: string; ms: number } => e.ms !== undefined)
    .sort((a, b) => b.ms - a.ms)

  const total = ranked.reduce((sum, e) => sum + e.ms, 0)

  return (
    <div className="inspector-profiler">
      <h3 className="inspector-section-title">Profiler</h3>
      <p className="profiler-total">Graph eval {formatEvalMs(total)}</p>
      {ranked.length === 0 ? (
        <p className="panel-hint">No nodes evaluated this frame</p>
      ) : (
        <ul className="profiler-list">
          {ranked.map((e) => (
            <li key={e.id} className={e.ms >= 2 ? 'hot' : e.ms >= 0.5 ? 'warm' : ''}>
              <span className="profiler-node">{e.label}</span>
              <span className="profiler-ms">{formatEvalMs(e.ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Inspector(): React.JSX.Element {
  const nodes = useGraphStore((s) => s.nodes)
  const updateParam = useGraphStore((s) => s.updateParam)

  const selected = nodes.find((n) => n.selected)
  const def = selected !== undefined ? getNodeType(selected.data.nodeType) : undefined
  const graphNodes = useMemo(
    (): NodeData[] =>
      nodes.map((n) => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        params: n.data.params,
        ...(n.data.paramBindings !== undefined ? { paramBindings: n.data.paramBindings } : {})
      })),
    [nodes]
  )

  return (
    <section className="inspector">
      <div className="panel-header">
        <h2>Inspector</h2>
      </div>
      <div className="inspector-body">
        {selected === undefined || def === undefined ? (
          <p className="panel-hint">Select a node to edit its parameters</p>
        ) : (
          <>
            <div className="inspector-title">
              <span className="inspector-label">{def.label}</span>
              <span className="inspector-type">{def.type}</span>
            </div>
            <p className="inspector-desc">{def.description}</p>
            {selected.data.nodeType === KEYBOARD_IN_NODE_TYPE && (
              <KeyboardInspectorPanel nodeId={selected.id} params={selected.data.params} />
            )}
            {selected.data.nodeType === GRADIENT_NODE_TYPE && (
              <div className="param-block gradient-inspector-block">
                <div className="param-row gradient-param-row">
                  <label>Ramp</label>
                </div>
                <GradientEditor
                  stops={parseGradientStops(selected.data.params['stops'], selected.data.params)}
                  onChange={(stops) => updateParam(selected.id, 'stops', stops)}
                />
              </div>
            )}
            {def.params.length === 0 ? (
              <p className="panel-hint">No parameters</p>
            ) : (
              def.params
                .filter(
                  (p) =>
                    p.type !== 'segments' &&
                    p.type !== 'gradient-stops' &&
                    p.type !== 'schedule' &&
                    p.type !== 'component' &&
                    !FIXTURE_INLINE_PARAMS.has(p.name) &&
                    !AUDIO_IN_INLINE_PARAMS.has(p.name) &&
                    !IMAGE_INLINE_PARAMS.has(p.name) &&
                    !VIDEO_INLINE_PARAMS.has(p.name) &&
                    !OUTPUT_INLINE_PARAMS.has(p.name) &&
                    !SYPHON_IN_INLINE_PARAMS.has(p.name) &&
                    !SYPHON_OUT_INLINE_PARAMS.has(p.name) &&
                    !KEYBOARD_INLINE_PARAMS.has(p.name)
                )
                .map((p) => (
                  <ParamRow
                    key={p.name}
                    nodeId={selected.id}
                    def={p}
                    value={selected.data.params[p.name] ?? null}
                    binding={selected.data.paramBindings?.[p.name]}
                    graphNodes={graphNodes}
                  />
                ))
            )}
          </>
        )}
        <ProfilerPanel />
      </div>
    </section>
  )
}
