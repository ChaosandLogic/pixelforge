# Contributing to PixelForge

Thanks for your interest in improving PixelForge! This document explains how to
build, test, and submit changes.

## Licensing of contributions

PixelForge is licensed under the **MIT License**. By submitting a pull request
you agree that your contribution is provided under the same MIT license
(inbound = outbound). Please only submit code you have the right to contribute.

## Development setup

Requires Node.js 20+, npm, and Rust (`cargo`) for the GPU sidecar.

```bash
npm install
npm run dev            # Editor with hot reload
npm run dev:player     # Build + launch the Player
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
- Never commit secrets or signing certificates.

## Architecture

See [`README.md`](README.md#architecture) for the process model (renderer /
main / engine-host `utilityProcess`), the pull-based evaluator, and the
SharedArrayBuffer output path.

## Reporting bugs / requesting features

Use the GitHub issue templates. For anything security-sensitive, follow
[`SECURITY.md`](SECURITY.md) instead of opening a public issue.

## Code of Conduct

By participating you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
