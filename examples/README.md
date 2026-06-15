# Example patches

Bundled `.pxf` projects demonstrating PixelForge nodes. Open from **Examples ▾** in the toolbar, or load any file via **Open**.

| File | Patch | What it shows |
|------|-------|----------------|
| `01-scrolling-wave.pxf` | 170px line strip | LFO → Offset → Wave chase |
| `02-matrix-rainbow.pxf` | 16×8 matrix | Resolution + Cylindrical sweep + HSV spin |
| `03-audio-reactive.pxf` | 64px line | Audio In drives Mix amount + Mask wipe (pick device/file) |
| `04-bpm-sequence.pxf` | 64px line | 4-segment sequence with BPM clock crossfades |
| `05-ring-pulse.pxf` | 60px ring | Distance field + LFO-pulsed strobe mix |
| `06-logic-switch.pxf` | 64px line | Compare + Switch between warm/cool gradients |

### Complex patches

| File | Patch | What it shows |
|------|-------|----------------|
| `07-club-show.pxf` | 16×8 matrix | 4-act show: per-act FX chains, BPM sequence, audio intensity + strobe, vignette Over |
| `08-nested-acts.pxf` | 128px line | Sequence-in-sequence: inner 3-beat acts inside outer 2-beat acts, BPM + audio crossfade |
| `09-venue-install.pxf` | Bar + ring + 24×6 matrix | Triple-branch compositing, spherical base, logic-routed accents |
| `10-signal-labyrinth.pxf` | 32×8 matrix | Deep float routing (delay/hold/ramp/gate/compare) → 5-layer pixel stack |

## Regenerate

After changing node types or params, rebuild from `scripts/build-examples.ts`:

```bash
npm run build:examples
```
