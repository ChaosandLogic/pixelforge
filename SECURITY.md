# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately via one of:

- GitHub's private vulnerability reporting (**Security → Report a vulnerability**
  on this repository), or
- email **security@pixelforge.app** with a description and reproduction steps.

We aim to acknowledge reports within **72 hours** and to provide a remediation
timeline after triage. Please give us a reasonable window to release a fix before
any public disclosure.

## Scope

Areas of particular interest:

- **Licensing** (`src/main/licensing`, `services/licensing`): signature
  verification, activation, and the license-enforcement path
  (`engine:request-port`).
- **IPC and file access** (`src/main/ipc`, `src/main/mediaAccess.ts`): the media
  read allowlist, project/show path handling, and path-traversal protections.
- **Networking / output** (`src/engine-host/output`): sACN / Art-Net / DDP.
- **Electron hardening**: context isolation, CSP, and the preload bridge.

## Out of scope

- The throwaway **development** keypair committed in
  `services/licensing/server.ts` is intentionally public so the local licensing
  server works out of the box. It is not used by production builds, which supply
  the signing key via `PIXELFORGE_LICENSE_PRIVATE_KEY` and ship a rotated client
  public key. Reports about this dev key being public are expected and not
  vulnerabilities.
- Bypassing license enforcement in a self-built copy is inherent to an
  open-source client and is not a vulnerability.

## Supported versions

Security fixes target the latest released version on the default branch.
