# Foxpile Companion

Foxpile Companion is the desktop client that watches Foxhole save files, builds trusted metadata, and sends
signed updates to the Foxpile API.

## What it does

- watches the Foxhole save directory
- detects when relevant save files change
- hashes the files before upload
- signs every request with companion credentials
- sends data only to the Foxpile API

## Trust model

The API accepts uploads only when the request is signed with the companion secret and matches the expected
companion identity.

## Configuration

Runtime values are resolved in this order:

1. environment variables
2. `src/generated-config.js` produced by the build
3. local development defaults

Required values:

- `FOXPILE_API_URL`
- `FOXPILE_COMPANION_ID`
- `FOXPILE_COMPANION_SECRET`

Optional values:

- `FOXPILE_COMPANION_SKEW_MS`
- `FOXPILE_GAME_PROCESS`

## Build

- `npm run dev` launches Foxpile Companion in debug mode from `cmd`
- `npm run build:windows` builds the Windows SEA executable and installer

The Windows build uses:

- Node 24
- Node SEA
- rcedit
- Inno Setup

## Local development data

Windows stores local connection state in:

`%LOCALAPPDATA%\Foxpile Companion\discord-connection.json`

An older `Foxpile` folder is migrated automatically when present.

## Support

If the companion cannot authenticate, it will not upload data to the API. This is expected behavior and is
part of the security model.
