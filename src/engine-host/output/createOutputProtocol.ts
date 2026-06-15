import { ArtNetProtocol } from './ArtNetProtocol'
import { DdpProtocol } from './DdpProtocol'
import { SacnProtocol } from './SacnProtocol'
import type { OutputProtocol, OutputProtocolConfig } from './OutputProtocol'

export function createOutputProtocol(config: OutputProtocolConfig): OutputProtocol {
  switch (config.protocol) {
    case 'artnet':
      return new ArtNetProtocol()
    case 'ddp':
      return new DdpProtocol()
    default:
      return new SacnProtocol()
  }
}
