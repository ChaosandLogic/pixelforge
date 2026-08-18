# Example patches

Bundled `.pxf` projects demonstrating PixelForge nodes. Open from **Examples ▾** in the toolbar, or load any file via **Open**.

| File | Patch | What it shows |
|------|-------|----------------|
| `01-scrolling-wave.pxf` | 170px line strip | LFO → Offset → Wave chase |
| `02-matrix-rainbow.pxf` | 16×8 matrix | Resolution + Cylindrical sweep + HSV spin |
| `03-audio-reactive.pxf` | 64px line | Audio In drives Mix amount + Mask wipe (pick device/file) |
| `04-bpm-sequence.pxf` | 64px line | Timeline (16-beat loop) → Sequence; phase scrolls Gradient |
| `05-ring-pulse.pxf` | 60px ring | Distance field + LFO-pulsed strobe mix |
| `06-logic-switch.pxf` | 64px line | Compare + Switch between warm/cool gradients |

### Complex patches

| File | Patch | What it shows |
|------|-------|----------------|
| `07-club-show.pxf` | 16×8 matrix | 4-act show: Timeline 40-beat loop, per-act FX, audio intensity + strobe, vignette |
| `08-nested-acts.pxf` | 128px line | Nested sequences, Timeline clocks both layers, loop trigger restarts Ramp |
| `09-venue-install.pxf` | Bar + ring + 24×6 matrix | Fixture scope → map-back → Merge, Timeline sequence, spherical base |
| `10-signal-labyrinth.pxf` | 32×8 matrix | Deep float routing (delay/hold/ramp/gate/compare) → 5-layer pixel stack |

### Visual looks

Self-running 2D generators — no audio, no Sequence / Timeline. Open one and let it loop.

| File | Patch | What it shows |
|------|-------|----------------|
| `11-plasma-field.pxf` | 32×16 matrix | Shader plasma + slow HSV drift |
| `12-tunnel-ride.pxf` | 32×16 matrix | Shader tunnel spinning through UV rotate + levels |
| `13-aurora-veil.pxf` | 32×16 matrix | Soft aurora shader through box blur + colour correct |
| `14-kaleido-garden.pxf` | 24×24 matrix | Perlin noise folded into 8 kaleidoscope segments |
| `15-ember-trails.pxf` | 24×16 matrix | Procedural fire with Feedback persistence |
| `16-ripple-warp.pxf` | 32×16 matrix | Ripple shader warped by a slow noise map |

## Regenerate

After changing node types or params, rebuild from `scripts/build-examples.ts`:

```bash
npm run build:examples
```
