/** Node types that run as 2D GPU TOPs in the sidecar. PixelSort stays CPU. */

export const TOP_NODE_TYPES: ReadonlySet<string> = new Set([
  'generator/solid-colour',
  'generator/gradient',
  'generator/wave',
  'generator/noise',
  'generator/video',
  'generator/image',
  'generator/shader',
  'generator/text',
  'generator/fire',
  'generator/syphon-in',
  'transform/transform',
  'transform/mirror',
  'transform/offset',
  'transform/scale',
  'transform/rotate',
  'transform/blur',
  'transform/mask',
  'transform/kaleidoscope',
  'transform/displace',
  'composite/mix',
  'composite/feedback',
  'composite/add',
  'composite/multiply',
  'composite/screen',
  'composite/over',
  'composite/merge',
  'colour/hsv-shift',
  'colour/levels',
  'colour/curves',
  'colour/palette-map',
  'colour/correct',
  'colour/from-value',
  'logic/switch',
  'setup/master'
])

export function isTopNodeType(type: string): boolean {
  return TOP_NODE_TYPES.has(type)
}

export const GPU_WORKING_RES_MAX = 512
export const GPU_PREVIEW_SIZE = 64
