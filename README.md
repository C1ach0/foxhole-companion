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
2. `src/core/generated-config.ts` produced by the build
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
- `npm run build:windows` builds the Windows GUI SEA, updater, and installer

## Source layout

- `src/app`: application lifecycle and single-instance handling
- `src/auth`: Discord authentication and persisted connection state
- `src/core`: configuration, runtime helpers, logging, errors, and shared types
- `src/game`: Foxhole process detection
- `src/saves`: save discovery, watching, validation, and upload
- `src/ui`: tray, Windows notifications, and startup settings
- `src/updates`: release selection, download verification, and updater launch

The Windows build uses:

- TypeScript
- Node 24
- Node SEA
- a GUI subsystem patch applied to the final SEA executable
- a standalone Windows updater
- rcedit
- Inno Setup

## Release

The CI workflow validates pushes and pull requests targeting `main`.
Windows releases are built only from tags matching `vX.Y.Z`.

1. Update the version in `package.json` and `package-lock.json`.
2. Commit or merge the release changes.
3. Create the matching tag on that commit.
4. Push the tag.

```powershell
git tag v1.1.0
git push origin v1.1.0
```

The release workflow checks out the exact commit referenced by the tag. The
tag version must match `package.json`, and the tagged commit must be part of
the `main` branch history.

## Local development data

Windows stores local connection state in:

`%LOCALAPPDATA%\Foxpile Companion\discord-connection.json`

An older `Foxpile` folder is migrated automatically when present.

## Support

If the companion cannot authenticate, it will not upload data to the API. This is expected behavior and is
part of the security model.
