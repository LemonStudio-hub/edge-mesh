# EdgeMesh

Browser-side P2P file distribution network powered by WebRTC, Cloudflare Workers, and Rust/WASM.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vue 3 Frontend                     │
│  (Pinia stores, WebRTC composables, file chunking)   │
└──────────────┬──────────────────────┬────────────────┘
               │ WebSocket/HTTP       │ WebRTC DataChannel
               ▼                      ▼
┌──────────────────────────┐  ┌───────────────────────┐
│  Cloudflare Worker       │  │  Browser ↔ Browser    │
│  (Hono router)           │  │  Direct P2P transfer  │
│  ┌────────────────────┐  │  └───────────────────────┘
│  │ Durable Objects    │  │
│  │ - SignalingRoom    │  │
│  │ - PostRegistry     │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Rust/WASM          │  │
│  │ - PeerID hashing   │  │
│  │ - File checksum    │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

## Key Features

- **WebRTC P2P** — Direct browser-to-browser file transfer, no server in the data path
- **IPv6-first** — Prioritizes IPv6 ICE candidates for better NAT traversal, with IPv4 STUN fallback
- **Lightweight signaling** — Cloudflare Workers + Durable Objects for connection coordination
- **Auto-expiring posts** — Posts are automatically deleted 5 minutes after the author goes offline
- **Mutual confirmation** — Connection requires both peers to accept before file transfer begins
- **Chunked transfer** — 64KB chunks with flow control and SHA-256 integrity verification

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, TypeScript, Vite, Pinia |
| Signaling | Cloudflare Workers, Hono, Durable Objects |
| Crypto/WASM | Rust, wasm-bindgen, sha2 |
| P2P | WebRTC (RTCPeerConnection, RTCDataChannel) |

## Project Structure

```
edge-mesh/
├── packages/
│   ├── shared/      # Shared TypeScript types and constants
│   ├── frontend/    # Vue 3 + Vite application
│   └── worker/      # Cloudflare Worker (Hono + Rust WASM)
│       └── src/wasm/edge-mesh-crypto/  # Rust crypto crate
└── docs/
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 10
- Rust toolchain with `wasm32-unknown-unknown` target
- wasm-pack (`cargo install wasm-pack`)

### Install

```bash
pnpm install
```

### Build WASM

```bash
pnpm wasm:build
```

### Development

Start the Cloudflare Worker (signaling server):
```bash
pnpm worker:dev
```

Start the Vue frontend (in another terminal):
```bash
pnpm dev
```

Open http://localhost:5173 in two browser tabs to test P2P connections.

### Deploy

Deploy the signaling worker:
```bash
pnpm worker:deploy
```

Build the frontend:
```bash
pnpm build
```

## How It Works

1. **Publish** — While online, create a post visible to all peers
2. **Connect** — Click another user's post to send a connection request
3. **Accept** — The target user sees a confirmation dialog
4. **Transfer** — After mutual confirmation, drag-and-drop files to transfer directly via WebRTC
5. **Auto-cleanup** — When a user goes offline, their posts are removed after 5 minutes

## License

MIT
