# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EdgeMesh is a browser-side peer-to-peer file distribution network. Files transfer directly between browsers via WebRTC DataChannels — the server never sees file data. The Cloudflare Worker handles only signaling (WebRTC offer/answer/ICE relay) and post coordination (a lightweight bulletin board for peer discovery).

## Commands

```bash
pnpm install              # Install all dependencies
pnpm wasm:build           # Compile Rust to WASM (required before worker dev/deploy)
pnpm dev                  # Start Vue frontend dev server (port 5173)
pnpm worker:dev           # Start Cloudflare Worker dev server (port 8787)
pnpm build                # Build all packages (shared → frontend → worker)
pnpm worker:deploy        # Deploy worker to Cloudflare
pnpm lint                 # Lint all packages (currently stubs)
pnpm clean                # Remove all node_modules, dist, pkg, target

# Worker tests (Vitest with @cloudflare/vitest-pool-workers)
pnpm -C packages/worker test
```

Frontend dev server proxies `/api` to `localhost:8787` with WebSocket support (configured in `packages/frontend/vite.config.ts`).

## Architecture

Three packages in a pnpm workspace (`packages/*`):

**`@edge-mesh/shared`** — Pure TypeScript types and constants. No runtime deps. Built with `tsc` (composite project references). Exports: `Post`, `PeerInfo`, `FileMetadata`, `SignalMessage`, `FileTransferMessage`, plus constants (`CHUNK_SIZE` 64KB, `ICE_CONFIG`, `STUN_SERVERS`, heartbeat/expiry timeouts).

**`@edge-mesh/frontend`** — Vue 3 + Vite SPA. Two routes: `/` (HomeView — peer discovery, post board, connection requests) and `/transfer` (TransferView — P2P file transfer). Four Pinia stores (`peer`, `posts`, `session`, `transfer`) and four composables (`useSignaling`, `useWebRTC`, `useFileTransfer`, `useOnlineStatus`). The `@/*` path alias maps to `src/*`.

**`@edge-mesh/worker`** — Cloudflare Worker using Hono router. Two Durable Objects: `PostRegistry` (post CRUD + heartbeat-based expiry via alarms) and `SignalingRoom` (WebSocket relay for WebRTC signaling). Also contains a Rust/WASM crate (`src/wasm/edge-mesh-crypto/`) for peer ID generation and SHA-256 checksums, built with `wasm-pack`.

### Data Flow

1. User creates a post → `POST /api/posts` → PostRegistry stores it
2. Other users poll `GET /api/posts` every 10s to discover peers
3. "Connect" sends `connect-request` via WebSocket → target sees accept/reject dialog (30s auto-reject)
4. On accept → WebRTC offer/answer/ICE exchange via SignalingRoom
5. Data channel opens → navigate to TransferView → drag-and-drop files for direct P2P transfer
6. 64KB chunks with flow control (pause at 1MB buffered, resume at 512KB), SHA-256 integrity verification
7. Heartbeats every 30s; posts auto-expire 5min after author goes offline

### Key Design Decisions

- **IPv6-first ICE strategy** — `ICE_CONFIG` in shared prioritizes IPv6 STUN servers for better NAT traversal, with IPv4 fallback
- **Mutual confirmation** — Both peers must explicitly accept before a WebRTC connection is established
- **No server in data path** — File bytes never touch the worker; all transfer is browser-to-browser via RTCDataChannel
- **CORS** — Hardcoded to `https://file.ijk.cam` in the worker's main Hono app
- **Production URLs** — Worker at `https://api.ijk.cam`, frontend at `https://file.ijk.cam`

## Code Style

- 2-space indentation (4 for Rust), LF line endings, UTF-8 (`.editorconfig`)
- No ESLint or Prettier configured; lint scripts are stubs
- TypeScript target: ES2022
- Rust toolchain: stable channel, `wasm32-unknown-unknown` target (`rust-toolchain.toml`)

## Environment Variables

See `.env.example` for required variables:
- `VITE_SIGNALING_URL` — WebSocket/HTTP base URL for the signaling worker
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` — For worker deployment

## License

AGPL-3.0 — see `LICENSE` for full text. If you run a modified version as a network service, you must make the source code available to users of that service.

## Docs

- `docs/architecture.md` — Component details, data flow, IPv6 strategy, file transfer protocol
- `docs/api.md` — REST endpoints and WebSocket message reference
- `docs/deployment.md` — Cloudflare Worker deployment, frontend hosting, production configuration
- `docs/development.md` — Development environment setup, debugging, testing, common workflows
