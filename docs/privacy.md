# Privacy — Chopsticks MVP

This document summarises what data the Chopsticks MVP collects, where it lives, and how long it is kept. For deployment and operational details see `docs/release.md`.

## What we collect

The MVP collects **no personal data** beyond the optional `displayName` a player enters when creating or joining a room. We do **not** collect:

- Accounts, email addresses, or passwords.
- Device identifiers or advertising IDs.
- Location, contacts, or camera/microphone access.
- Analytics, crash reporting, or telemetry.

`clientId` is an opaque token generated locally by the client. It is used only to identify the current connection/seat and is never linked to an identity.

## Where data lives

- `displayName` and the game state/moves for a room are written to the configured `RoomStore` (default `data/rooms.json`).
- Data is stored on the server filesystem, not on third-party services.
- The web and iOS clients keep game state in memory only; no client-side persistence is implemented.

## Retention

- Room data persists until the room is removed by the server or the store file is deleted by an operator.
- There is no automatic per-room TTL in the MVP. A future release may add expiration/cleanup.
- To remove all retained data, stop the server and delete the store file (`data/rooms.json` by default).

## Transport security

The MVP server speaks plain HTTP. In production it must be placed behind a TLS-terminating reverse proxy (Caddy, nginx, cloud load balancer) so display names and game traffic are encrypted in transit.

## Questions / changes

Privacy policy changes that affect collected data or retention require an update to this file and a note in `PROGRESS.md`.
