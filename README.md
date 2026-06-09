# Foxpile Companion

Foxpile Companion is the desktop client that watches Foxhole save files, builds trusted metadata, and sends
only signed updates to the Foxpile API.

This project is intentionally split from the private API. The companion repository is public-facing and
contains only the client code; the API stays in its own private repository.

## What it does

- watches the Foxhole save directory
- detects when relevant save files change
- hashes the files before upload
- signs every request with companion credentials
- sends data only to the Foxpile API

## Trust model

The API accepts uploads only when the request is signed with the companion secret and matches the expected
companion identity.

That means:

- unofficial binaries are not supported
- custom local builds will not be able to talk to the API unless they have the official signing values
- the official build pipeline is the only supported way to produce a working release

In practice, the secret is injected by GitHub Actions during the release build. If the secret is missing,
the companion cannot sign requests and the API will reject the upload.

## Configuration

The companion resolves its runtime values in this order:

1. environment variables
2. `src/generated-config.js` produced by the GitHub build
3. local development defaults

Required values:

- `FOXPILE_API_URL`
- `FOXPILE_COMPANION_ID`
- `FOXPILE_COMPANION_SECRET`

Optional values:

- `FOXPILE_COMPANION_SKEW_MS`
- `FOXPILE_GAME_PROCESS`

## Official build

For releases, GitHub Actions generates `src/generated-config.js` from repository secrets and builds the
Windows binary from that configuration.

Recommended secrets:

- `FOXPILE_API_URL`
- `FOXPILE_COMPANION_ID`
- `FOXPILE_COMPANION_SECRET`
- `FOXPILE_COMPANION_SKEW_MS`
- `FOXPILE_GAME_PROCESS`

## Local development

Copy `.env.example` to `.env` and fill in your test values.

Local builds are useful for development, but they are not the official release path.

## Discord connection storage

When a user links Discord, the companion stores the local connection state in:

Windows:
`%LOCALAPPDATA%\Foxpile\discord-connection.json`

macOS:
`~/Library/Application Support/Foxpile/discord-connection.json`

Linux:
`~/.config/Foxpile/discord-connection.json`

On the next startup, the companion reloads that file and restores the linked Discord state so the user
does not need to repeat the link flow.

Clicking the Discord entry in the tray again unlinks the account and removes the local file.

## Support

If the companion cannot authenticate, it will not upload data to the API. This is expected behavior and is
part of the security model.
