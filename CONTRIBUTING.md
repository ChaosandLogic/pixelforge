# Contributing to PixelForge

Thanks for your interest in improving PixelForge! This document explains how to
build, test, and submit changes.

## Contributor License Agreement (required)

PixelForge is dual-licensed (AGPL-3.0 + a commercial license — see
[`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md)). To keep that model viable, all
contributors must agree to the [Contributor License Agreement](CLA.md) before
their first pull request can be merged. Our CLA bot will prompt you on your first
PR; agreeing is a one-time step.

In short: you keep copyright to your contribution, but grant the project the
rights needed to distribute it under both the AGPL-3.0 and the commercial
license.

## Development setup

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev            # Editor with hot reload
npm run dev:player     # Build + launch the Player
npm run license:server # Local activation API (demo key PF-DEMO-EDITOR)
```

## Before you open a PR

Run the full local check suite — CI runs the same commands:

```bash
npm run typecheck
npm test
npm run build
```

- Keep changes focused; one logical change per PR.
- Match the existing TypeScript style (strict types, no unchecked `any`).
- Add or update tests under `src/**/*.test.ts` for engine, export, and format
  logic. New node types and export/loop behaviour should come with tests.
- Do not add narration comments; comment only non-obvious intent.
- Never commit secrets, signing certificates, or a production signing key. The
  keypair in `services/licensing/server.ts` is a throwaway **dev** key only.

## Architecture

See [`README.md`](README.md#architecture) and
[`PIXELFORGE_PLAN.md`](PIXELFORGE_PLAN.md) for the process model (renderer /
main / engine-host `utilityProcess`), the pull-based evaluator, and the
SharedArrayBuffer output path.

## Reporting bugs / requesting features

Use the GitHub issue templates. For anything security-sensitive, follow
[`SECURITY.md`](SECURITY.md) instead of opening a public issue.

## Code of Conduct

By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
