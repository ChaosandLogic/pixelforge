[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H0C122Q7UR)

# PixelForge

Node-based LED sequencer with sACN output, 3D visualisation, and live effect authoring.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PixelForge is **fully open source**. The Editor, Player, GPU engine, and bundled
examples are all in this repository, licensed under the [MIT License](LICENSE).
You can use, study, modify, and share the whole project.

```bash
git clone https://github.com/ChaosandLogic/pixelforge.git
cd pixelforge
npm install
npm run dev
```

## Example patches

Sixteen example projects ship in [`examples/`](examples/). Use **Examples ▾** in the toolbar to load one — six starter demos, four complex patches (club show, nested sequences, multi-fixture venue install, and signal labyrinth), and six visual looks (plasma, tunnel, aurora, kaleidoscope, fire trails, ripple warp).

## Architecture

The real-time pipeline runs in a dedicated Electron `utilityProcess` (the engine host), fully isolated from the UI. 2D texture-style nodes (TOPs) render on a native **gpu-engine** sidecar (`wgpu`: Metal / DirectX / Vulkan) at the patch’s logical resolution, then UV-sample onto LEDs. Floats, Sequence, 1D generators, and sACN stay on the CPU evaluator. If the sidecar is missing, those nodes fall back to CPU `evaluate()`.

```
Renderer (React, UI only)
   │  graph/patch/config over MessagePort
   ▼
Engine host (utilityProcess)
   ├─ FrameClock ── drift-corrected ~44 fps tick
   ├─ Evaluator ── floats / Sequence / 1D nodes; writes RGB into SharedArrayBuffer
   ├─ gpu-engine sidecar ── wgpu TOP passes, media decode, Syphon (macOS)
   └─ Output worker (worker_thread) ── reads SAB on its own tick,
      packs DMX frames, sends sACN (E1.31) UDP packets
```

- The SharedArrayBuffer never leaves the engine host; the renderer receives per-frame copies for preview only.
- The output worker ticks independently of evaluation — a slow frame never delays a DMX packet, and continuous resends satisfy sACN keepalive.
- A renderer hang or crash never stops DMX output.

## Development

Requires **Node.js 20+**, **npm**, and **Rust/cargo** (for `gpu-engine`).

```bash
npm install
npm run dev              # Editor with HMR
npm run dev:player       # Player (build + launch)
npm run typecheck
npm test
npm run build
npm run dist:editor      # macOS/Windows Editor installer
npm run dist:player      # macOS/Windows Player installer
npm run build:examples
```

Run the built Player directly with a show:

```bash
npm run build
npx electron out/main/player.js --project examples/01-scrolling-wave.pxf --auto-output
```

`npm run build` compiles the Rust `gpu-engine` sidecar (`cargo` required) then the Electron app. Packaged builds copy the binary into `extraResources` and codesign it with the app on macOS.

**Environment variables:**

- `PIXELFORGE_SENTRY_DSN` — enable crash reporting (optional)
- `PIXELFORGE_GPU_ENGINE` — path to the `gpu-engine` sidecar (set automatically by the engine launcher)

## Rack / startup show (Player)

Configure a show to load automatically when Player opens or at system login — no bash script required.

**In Player (recommended):**

1. Open **Startup Show** (toolbar or File menu).
2. Browse to a `.pxf` file or exported show folder (`show.json` + bundled media).
3. Choose **Windowed Player** or **Headless** (required before launch-at-login).
4. Optionally pin the network interface and enable **Auto-start output**.
5. Check **Launch at login** and click **Save**.

Use **Apply now** to test without rebooting.

**CLI equivalents (macOS / Windows):**

```bash
# Windowed Player with auto-output
PixelForge\ Player.app --project /path/to/show.pxf --auto-output --interface 192.168.1.10

# Rack / NUC headless mode
PixelForge\ Player.app --headless --show-dir /path/to/show-folder --interface en0 --auto-output
```

Exported show folders can include optional startup hints in `show.json` (set when exporting from the Editor). Player prefills Startup Show settings from those hints when you pick the folder.

On Linux, automatic login registration is limited — Player shows a manual autostart command you can add to your desktop session startup.

## Using it

1. **File → New / Open / Save** (or **Cmd/Ctrl+S**) — projects are `.pxf` files. **Examples ▾** in the toolbar loads bundled demos.
2. Build or import a patch from **Patch** next to **+ Add node**: layout builder (line / matrix / ring), or CSV/JSON point import. Pixel order in the patch **is** channel order.
3. Author the node graph. Wire effect nodes into a **Pixel Output** node and choose sACN, Art-Net, or DDP (plus start universe / host). **Syphon / Spout In** pulls a texture from Resolume, VDMX, OBS, or TouchDesigner; **Syphon / Spout Out** publishes the LED image for those apps (macOS/Windows).
4. On Pixel Output, pick **Send from** if you need a specific NIC (or leave System default).
5. Toggle **Output ON**. A controller patched to that universe/stream will light up.
6. Use the **3D** preview tab to load an STL reference mesh and see live pixel colours on the layout.
7. The status bar shows engine fps, packets/sec, and send errors. **Export ▾** writes a Player show folder, ESP32 ALED, or Falcon Player FSEQ.

## Limits

These are current product limits, not bugs:

- **RGB and RGBW.** The engine evaluates in RGB. Pixel Output can emit RGB (170 pixels per sACN/Art-Net universe) or RGBW (128 pixels per universe), deriving the white channel at output with a subtractive or luminance strategy. Addressing is sequential from the Pixel Output start universe — there are no per-pixel universe/channel overrides.
- **32,768 pixels max** (~193 sACN universes in RGB, or 256 in RGBW). Larger layouts are truncated with a warning in the Patch dialog.
- **Live audio, MIDI, and keyboard** are captured in the Editor/Player window and pushed to the engine. They do not run in **headless** Player or in baked ESP/FSEQ exports. Use OSC In, Syphon/Spout In (engine-side, macOS/Windows), or sACN streaming from a windowed Player for interactive rack shows.
- **Syphon / Spout** is macOS (Syphon Metal) and Windows (Spout) only. Frames are copied through CPU RGBA (same path as video), so 1080p is downsampled before it hits the LED sampler. Linux shows the nodes as unavailable.

## Project layout

```
src/
├── main/          # Electron main process: window, engine launcher, IPC
├── preload/       # Context bridge + engine MessagePort forwarding
├── engine-host/   # utilityProcess: FrameClock, evaluator, GPU client, output
├── shared/        # Types and node defs shared by renderer and engine host
└── renderer/src/  # React UI: graph, inspector, 2D/3D preview, status bar
    └── visualiser/  # Three.js InstancedMesh + STL reference mesh
gpu-engine/        # Native wgpu sidecar (Metal / DirectX / Vulkan)
examples/          # Bundled .pxf demos
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Report security issues via [SECURITY.md](SECURITY.md), not public issues.

## License

PixelForge is licensed under the [MIT License](LICENSE).

Third-party dependencies are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
