# API Contract — Phase 1

## Normalized observation envelope

```json
{
  "tagName": "Z04_MOISTURE",
  "value": 38.2,
  "engineeringUnit": "%",
  "sourceSystemId": "node-red-zone04",
  "protocol": "MQTT",
  "sourceTimestamp": null,
  "receivedTimestamp": "2026-10-23T12:00:00.000Z",
  "quality": "GOOD",
  "qualityReason": null
}
```

This is a target contract, not a description of the current response from every endpoint.

## Proposed health endpoint

A future `GET /api/health` should report API, PostgreSQL, and each source independently. Do not use `GET /api` success as evidence of DB/PLC health. Until a source-specific check exists, report `UNKNOWN`, not `CONNECTED`.

## Current endpoints

`/api`, `/api/equipment`, `/api/tags`, `/api/tags/:tagName/value`, `/api/zone3`, `/api/live`, `POST /api/zone3/command`, `/api/zone4`.

Suggested errors: `400` invalid request; `404` unknown tag/resource; `409` interlock violation; `502` upstream rejection; `503` required integration unavailable; `500` unexpected internal failure. Never expose stack traces, credentials, or raw DB errors to the browser.
