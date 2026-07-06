# Third-Party Notices

PixelForge is distributed under the GNU Affero General Public License v3.0
(see [`LICENSE`](LICENSE)). It bundles third-party open source software, each
under its own license. All bundled runtime dependencies use permissive licenses
that are compatible with the AGPL-3.0.

## License summary (production dependency tree)

| License | Count |
|---------|-------|
| MIT | 72 |
| Apache-2.0 | 36 |
| ISC | 13 |
| Python-2.0 | 1 |
| BSD-3-Clause | 1 |
| BSD-2-Clause | 1 |
| BlueOak-1.0.0 | 1 |

All of the above are permissive, attribution-style licenses and impose no
copyleft obligations on this project.

## Primary direct dependencies

| Package | License | Project |
|---------|---------|---------|
| react, react-dom | MIT | https://react.dev |
| zustand | MIT | https://github.com/pmndrs/zustand |
| @xyflow/react | MIT | https://reactflow.dev |
| three | MIT | https://threejs.org |
| sacn | Apache-2.0 | https://github.com/k-yle/sACN |
| @sentry/electron | MIT | https://github.com/getsentry/sentry-electron |
| electron-updater | MIT | https://github.com/electron-userland/electron-builder |
| node-machine-id | MIT | https://github.com/automation-stack/node-machine-id |
| electron | MIT | https://www.electronjs.org |

## Regenerating the full attribution list

The complete, versioned list of every dependency and its license text can be
regenerated from the installed tree:

```bash
# Machine-readable summary
npx license-checker-rseidelsohn --production --summary

# Full CSV with repository URLs
npx license-checker-rseidelsohn --production --csv --out THIRD-PARTY-LICENSES.csv

# Full license texts, one file
npx license-checker-rseidelsohn --production --plainVertical --out THIRD-PARTY-LICENSES.txt
```

Individual license texts are also distributed inside each package under
`node_modules/<package>/` (typically `LICENSE`, `LICENSE.md`, or `README`).
