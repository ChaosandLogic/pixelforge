import type { GpuGradientStop, GpuNodeUniforms } from '@shared/gpu/protocol'
import { parseGradientStops } from '@shared/colour/gradientStops'
import type { EvalContext, NodeData, ParamValues, PortValues } from '@shared/graph/types'
import { colourParam, floatInput, floatParam, intParam, stringParam } from '@shared/graph/types'

function colour01(params: ParamValues, name: string): number[] {
  const c = colourParam(params, name)
  return [c.r / 255, c.g / 255, c.b / 255]
}

function empty(): GpuNodeUniforms {
  return { floats: [], colours: [], ints: [], strings: [] }
}

/** Pack CPU params/float inputs into the sidecar uniform layout. */
export function collectGpuUniforms(
  node: NodeData,
  inputs: PortValues,
  params: ParamValues,
  ctx: EvalContext
): GpuNodeUniforms {
  const u = empty()
  const timeSec = ctx.timeMs / 1000
  switch (node.type) {
    case 'generator/solid-colour':
      u.colours = colour01(params, 'colour')
      break
    case 'generator/gradient': {
      const stops = parseGradientStops(params['stops'], params)
      u.stops = stops.map(
        (s): GpuGradientStop => ({
          t: s.position,
          r: s.colour.r / 255,
          g: s.colour.g / 255,
          b: s.colour.b / 255
        })
      )
      u.strings = [stringParam(params, 'axis', 'x')]
      u.ints = [params['mirror'] === true ? 1 : 0]
      const phase =
        floatInput(inputs, params, 'phase', floatParam(params, 'phase', 0)) +
        timeSec * floatParam(params, 'speed', 0)
      u.floats = [
        0,
        1,
        floatParam(params, 'offset', 0),
        floatParam(params, 'scale', 1),
        phase,
        0,
        floatParam(params, 'centreX', 0.5),
        floatParam(params, 'centreY', 0.5),
        floatParam(params, 'centreZ', 0.5)
      ]
      break
    }
    case 'generator/wave':
      u.colours = [...colour01(params, 'colourA'), ...colour01(params, 'colourB')]
      u.strings = [stringParam(params, 'axis', 'x')]
      u.floats = [0, 1, floatParam(params, 'frequency', 2), floatParam(params, 'speed', 0.5)]
      break
    case 'generator/noise':
      u.colours = [
        ...colour01(params, 'colourA'),
        ...colour01(params, 'colourB')
      ]
      u.strings = [stringParam(params, 'noiseType', 'value2d')]
      u.floats = [
        0,
        1,
        floatParam(params, 'scale', 5),
        floatParam(params, 'speed', 1),
        floatParam(params, 'wScale', 0),
        floatParam(params, 'contrast', 1)
      ]
      break
    case 'composite/mix':
      u.strings = [stringParam(params, 'mode', 'mix')]
      u.floats = [Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 0.5)))]
      break
    case 'composite/add':
    case 'composite/multiply':
    case 'composite/screen':
      u.floats = [Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 1)))]
      break
    case 'composite/over':
      u.floats = [Math.max(0, Math.min(1, floatInput(inputs, params, 'opacity', 1)))]
      break
    case 'composite/merge':
      u.strings = [stringParam(params, 'mode', 'add')]
      break
    case 'composite/feedback':
      u.strings = [stringParam(params, 'mode', 'add')]
      u.floats = [
        Math.max(0, Math.min(1, floatInput(inputs, params, 'amount', 0.85))),
        1,
        Math.max(0, Math.min(1, floatParam(params, 'decay', 0.95)))
      ]
      break
    case 'transform/blur':
      u.strings = [stringParam(params, 'direction', 'both'), stringParam(params, 'edges', 'clamp')]
      u.floats = [0, 1, Math.max(0, Math.min(32, floatInput(inputs, params, 'radius', intParam(params, 'radius', 2))))]
      break
    case 'colour/hsv-shift':
      u.floats = [
        0,
        1,
        floatParam(params, 'hue') + timeSec * floatParam(params, 'hueSpeed'),
        floatParam(params, 'saturation', 1),
        floatParam(params, 'value', 1)
      ]
      break
    case 'colour/levels':
      u.floats = [
        0,
        1,
        floatParam(params, 'brightness', 1),
        floatParam(params, 'contrast', 1),
        1 / Math.max(0.001, floatParam(params, 'gamma', 1))
      ]
      break
    case 'colour/curves':
      u.floats = [
        0,
        1,
        floatParam(params, 'shadows'),
        floatParam(params, 'midtones'),
        floatParam(params, 'highlights')
      ]
      break
    case 'colour/palette-map':
      u.colours = [
        ...colour01(params, 'dark'),
        ...colour01(params, 'light')
      ]
      break
    case 'colour/correct': {
      const temp = floatParam(params, 'temperature')
      u.floats = [
        0,
        1,
        floatParam(params, 'lift'),
        1 / Math.max(0.001, floatParam(params, 'gamma', 1)),
        floatParam(params, 'gain', 1),
        0,
        1 + temp * 0.2,
        1 - temp * 0.2
      ]
      break
    }
    case 'colour/from-value':
      u.colours = [...colour01(params, 'from'), ...colour01(params, 'to')]
      u.floats = [Math.max(0, Math.min(1, floatInput(inputs, params, 'value', floatParam(params, 'value', 0.5))))]
      break
    case 'logic/switch':
      u.floats = [floatInput(inputs, params, 'select', 0), 1, floatParam(params, 'threshold', 0.5)]
      break
    case 'setup/master': {
      let level = Math.max(0, Math.min(1, floatInput(inputs, params, 'level', floatParam(params, 'level', 1))))
      if (ctx.consumeTrigger(ctx.nodeId, 'mute')) level = 0
      u.floats = [level]
      break
    }
    case 'transform/rotate':
      u.floats = [
        0,
        1,
        floatInput(inputs, params, 'angle') + timeSec * floatParam(params, 'speed'),
        floatParam(params, 'centreU', 0.5),
        floatParam(params, 'centreV', 0.5)
      ]
      break
    case 'transform/kaleidoscope':
      u.strings = [stringParam(params, 'mode', 'mirror')]
      u.floats = [0, 1, intParam(params, 'segments', 6), floatParam(params, 'centreU', 0.5), floatParam(params, 'centreV', 0.5)]
      break
    case 'transform/displace':
      u.strings = [stringParam(params, 'mode', 'luminance-x'), stringParam(params, 'edges', 'clamp')]
      u.floats = [Math.max(0, Math.min(32, floatInput(inputs, params, 'amount', floatParam(params, 'amount', 4))))]
      break
    case 'transform/transform':
      u.strings = [stringParam(params, 'edges', 'wrap')]
      u.ints = [0, params['flip'] === true ? 1 : 0]
      u.floats = [
        0,
        1,
        floatInput(inputs, params, 'translate') + timeSec * floatParam(params, 'speed'),
        floatParam(params, 'centre', 0.5),
        Math.max(0.001, floatParam(params, 'scale', 1))
      ]
      break
    case 'transform/mirror':
      u.strings = [stringParam(params, 'mode', 'fold')]
      break
    case 'transform/offset':
      u.floats = [0, 1, floatParam(params, 'offset') + timeSec * floatParam(params, 'speed')]
      break
    case 'transform/scale':
      u.strings = [stringParam(params, 'edges', 'wrap')]
      u.floats = [0, 1, Math.max(0.001, floatParam(params, 'scale', 1)), floatParam(params, 'centre', 0.5)]
      break
    case 'transform/mask':
      u.ints = [0, 0, params['invert'] === true ? 1 : 0]
      u.floats = [
        0,
        1,
        floatParam(params, 'start', 0.25),
        floatParam(params, 'end', 0.75),
        floatParam(params, 'softness', 0.1),
        floatInput(inputs, params, 'offset')
      ]
      break
    case 'generator/video':
    case 'generator/image':
    case 'generator/syphon-in':
      u.strings = [stringParam(params, 'fit', 'cover')]
      u.floats = [0, floatParam(params, 'gain', 1)]
      u.ints = [0, 0, 0, node.type === 'generator/syphon-in' ? 1 : 0]
      break
    case 'generator/fire':
      u.floats = [
        0,
        1,
        floatParam(params, 'scale', 4),
        floatParam(params, 'speed', 1.2),
        floatParam(params, 'turbulence', 0.6),
        floatParam(params, 'rise', 0.55)
      ]
      break
    case 'generator/shader':
      u.strings = [stringParam(params, 'preset', 'plasma')]
      u.colours = [
        ...colour01(params, 'colourA'),
        ...colour01(params, 'colourB')
      ]
      u.floats = [
        0,
        floatParam(params, 'intensity', 1),
        floatParam(params, 'scale', 1)
      ]
      break
    case 'generator/text':
      u.strings = [stringParam(params, 'text', '12:34'), stringParam(params, 'align', 'center')]
      u.colours = colour01(params, 'colour')
      u.floats = [
        floatInput(inputs, params, 'scale', floatParam(params, 'scale', 1)),
        floatInput(inputs, params, 'scrollX', floatParam(params, 'scrollX', 0)),
        floatParam(params, 'speed', 0),
        floatParam(params, 'background', 0)
      ]
      break
    default:
      break
  }
  return u
}

export function fileParam(params: ParamValues): string {
  const v = params['file']
  return typeof v === 'string' ? v : ''
}
