import type { NodeTypeDef } from '../../types'

export const OUTPUT_NODE_TYPE = 'output/pixel'

/** Params edited inline on the node card (hidden from Inspector). */
export const OUTPUT_INLINE_PARAMS = new Set(['protocol', 'startUniverse', 'sacnHost', 'ddpHost', 'ddpPort', 'transmit'])

/**
 * Terminal node: the evaluator pulls this node's 'pixels' input and writes
 * it into the SharedArrayBuffer. Output protocol and addressing are read
 * from this node's params when configuring the output sender.
 */
export const PixelOutput: NodeTypeDef = {
  type: OUTPUT_NODE_TYPE,
  label: 'Pixel Output',
  category: 'output',
  description: 'Sends pixels via sACN, Art-Net, or DDP',
  inputs: [{ name: 'pixels', label: 'Pixels', type: 'pixels' }],
  outputs: [],
  params: [
    {
      name: 'protocol',
      label: 'Protocol',
      type: 'select',
      default: 'sacn',
      options: ['sacn', 'artnet', 'ddp']
    },
    { name: 'startUniverse', label: 'Start universe', type: 'int', default: 1, min: 1, max: 63999 },
    {
      name: 'sacnHost',
      label: 'sACN host',
      type: 'string',
      default: ''
    },
    { name: 'ddpHost', label: 'DDP host', type: 'string', default: '255.255.255.255' },
    { name: 'ddpPort', label: 'DDP port', type: 'int', default: 4048, min: 1, max: 65535 },
    { name: 'transmit', label: 'Transmit', type: 'boolean', default: true }
  ],
  evaluate() {
    return {}
  }
}
