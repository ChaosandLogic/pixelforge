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

- **IPC and file access** (`src/main/ipc`, `src/main/mediaAccess.ts`): the media
  read allowlist, project/show path handling, and path-traversal protections.
- **Networking / output** (`src/engine-host/output`): sACN / Art-Net / DDP.
- **Electron hardening**: context isolation, CSP, and the preload bridge.

## Supported versions

Security fixes target the latest released version on the default branch.
