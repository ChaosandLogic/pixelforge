# PixelForge Licensing API

Local development server for Editor/Player license activation.

## Start

```bash
npm run license:server
```

Listens on `http://127.0.0.1:8787` by default (`PORT` env to override).

## Demo license

| Field | Value |
|-------|-------|
| License key | `PF-DEMO-EDITOR` |
| Email | `demo@pixelforge.app` |
| Player slots | 3 |

## Endpoints

- `POST /v1/activate` — activate Editor or Player (consumes player slot)
- `POST /v1/deactivate` — free a slot/seat
- `POST /v1/heartbeat` — periodic validation
- `GET /v1/license/:key/status` — slot usage
- `POST /v1/webhook/purchase` — stub for payment provider webhooks

## Development bypass

Set `PIXELFORGE_DEV_LICENSE=1` to skip license gates in the apps without activating.

## App configuration

Set `PIXELFORGE_LICENSE_API=http://127.0.0.1:8787` if the API runs on a non-default host.
