/**
 * Drift-corrected frame timer. Each tick schedules against an absolute
 * target time rather than a fixed delay, so timer slop doesn't accumulate.
 * If we fall badly behind (blocked event loop), we resync instead of
 * bursting catch-up ticks.
 */
export class FrameClock {
  private timer: NodeJS.Timeout | null = null
  private nextTarget = 0
  private lastTick = 0
  private intervalMs: number

  constructor(
    targetFps: number,
    private readonly onTick: (timeMs: number, deltaMs: number) => void
  ) {
    this.intervalMs = 1000 / targetFps
  }

  setTargetFps(fps: number): void {
    this.intervalMs = 1000 / fps
  }

  start(): void {
    if (this.timer !== null) return
    this.lastTick = performance.now()
    this.nextTarget = this.lastTick + this.intervalMs
    this.schedule()
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(): void {
    const delay = Math.max(0, this.nextTarget - performance.now())
    this.timer = setTimeout(() => this.tick(), delay)
  }

  private tick(): void {
    if (this.timer === null) return
    const now = performance.now()
    const delta = now - this.lastTick
    this.lastTick = now

    this.nextTarget += this.intervalMs
    if (this.nextTarget < now) {
      // Too far behind to catch up smoothly — resync.
      this.nextTarget = now + this.intervalMs
    }

    this.onTick(now, delta)
    if (this.timer !== null) this.schedule()
  }
}
