/**
 * Protocol abstraction for pixel output. The engine hands every protocol
 * one flat channel stream in patch order (RGB or RGBW). Each implementation
 * chunks it as its wire format requires.
 */
import type { OutputProtocolKind } from '@shared/output/config'
import type { ColorMode, WhiteMode } from '@shared/output/rgbw'

export interface OutputProtocolConfig {
  /** Active wire protocol */
  protocol: OutputProtocolKind
  /** Local interface IP to bind to (undefined = OS default) */
  iface?: string
  /** First universe for universe-based protocols (ignored by DDP) */
  startUniverse: number
  /** DDP destination host (unicast or broadcast) */
  ddpHost?: string
  /** DDP destination UDP port */
  ddpPort?: number
  /** sACN unicast destination; omit/empty = E1.31 multicast (239.255.x.x) */
  sacnHost?: string
  /** Wire colour mode of `send()` payloads (RGB or already-expanded RGBW). */
  colorMode?: ColorMode
  whiteMode?: WhiteMode
}

export interface OutputProtocol {
  readonly name: string
  configure(config: OutputProtocolConfig): void
  /** Send one frame; resolves to the number of packets transmitted. */
  send(stream: Uint8Array): Promise<number>
  close(): void
}
