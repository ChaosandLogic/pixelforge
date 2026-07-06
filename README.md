[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H0C122Q7UR)

# PixelForge

Node-based LED sequencer with sACN output, 3D visualisation, and live effect authoring.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

PixelForge is free and open source under the **GNU AGPL-3.0**. Everything — the
Editor, the Player, and the engine — is in this repository and free to build,
run, and modify.

See [PIXELFORGE_PLAN.md](PIXELFORGE_PLAN.md) for the full development plan.

## Example patches

Ten example projects ship in [`examples/`](examples/). Use **Examples ▾** in the toolbar to load one — six starter demos plus four complex patches (club show, nested sequences, multi-fixture venue install, and signal labyrinth).

## Architecture

The real-time pipeline runs in a dedicated Electron `utilityProcess` (the engine host), fully isolated from the UI:

```
Renderer (React, UI only)
   │  graph/patch/config over MessagePort
   ▼
Engine host (utilityProcess)
   ├─ FrameClock ── drift-corrected ~44 fps tick
   ├─ Evaluator ── writes RGB into SharedArrayBuffer
   └─ Output worker (worker_thread) ── reads SAB on its own tick,
      packs DMX frames, sends sACN (E1.31) UDP packets
```

- The SharedArrayBuffer never leaves the engine host; the renderer receives per-frame copies for preview only.
- The output worker ticks independently of evaluation — a slow frame never delays a DMX packet, and continuous resends satisfy sACN keepalive.
- A renderer hang or crash never stops DMX output.

## Development

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

**Environment variables:**

- `PIXELFORGE_SENTRY_DSN` — enable crash reporting (optional)

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

1. Pick a network interface in the left panel (or leave on system default).
2. Set the sACN universe and pixel count in the toolbar.
3. Choose a colour and toggle **Output ON**.
4. Use the **3D** preview tab: load an STL reference mesh, orbit with drag, and see live pixel colours on your patch positions.
5. The status bar shows engine fps, packets/sec, and any send errors. A real sACN node patched to that universe will light up.

## Project layout

```
src/
├── main/          # Electron main process: window, engine launcher, IPC
├── preload/       # Context bridge + engine MessagePort forwarding
├── engine-host/   # utilityProcess: FrameClock, evaluator, output sender
├── shared/        # Types shared between renderer and engine host
└── renderer/      # React UI: toolbar, network panel, 2D/3D preview, status bar
    └── visualiser/  # Three.js InstancedMesh + STL reference mesh
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).
Security issues should follow [SECURITY.md](SECURITY.md) rather than public issues.

## License

PixelForge is licensed under the [GNU Affero General Public License v3.0](LICENSE).
If you run a modified version and expose it to users over a network, the AGPL
requires you to make your source available to them.

Third-party dependencies are listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

"PixelForge" and the PixelForge logo are trademarks — see
[TRADEMARKS.md](TRADEMARKS.md). The AGPL covers the source code, not the marks.
