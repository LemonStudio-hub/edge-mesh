# EdgeMesh

<p align="center">
  <strong>Browser-side peer-to-peer file distribution network</strong><br>
  Files transfer directly between browsers via WebRTC — the server never sees your data.
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0"></a>
  <a href="https://github.com/LemonStudio-hub/edge-mesh/releases"><img src="https://img.shields.io/badge/version-0.1.0-green.svg" alt="Version 0.1.0"></a>
  <a href="https://file.ijk.cam"><img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live Demo"></a>
</p>

---

## Table of Contents

- [What is EdgeMesh?](#what-is-edgemesh)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Build WASM](#build-wasm)
  - [Development](#development)
  - [Production Deployment](#production-deployment)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## What is EdgeMesh?

EdgeMesh is a **browser-side peer-to-peer file distribution network**. Instead of uploading files to a central server, EdgeMesh establishes direct WebRTC DataChannels between browsers for file transfer. The server (a lightweight Cloudflare Worker) handles only two things:

1. **Signaling** — relaying WebRTC offer/answer/ICE candidates between peers
2. **Post coordination** — a lightweight bulletin board where peers announce themselves

File bytes **never touch the server**. All data flows browser-to-browser, encrypted by WebRTC's built-in DTLS/SRTP transport.

## Key Features

| Feature | Description |
|---------|-------------|
| **WebRTC P2P** | Direct browser-to-browser file transfer with no server in the data path |
| **IPv6-first ICE** | Prioritizes IPv6 STUN candidates for better NAT traversal, with IPv4 fallback |
| **Mutual confirmation** | Both peers must explicitly accept before a connection is established |
| **Chunked transfer** | 64 KB chunks with backpressure flow control (pause at 1 MB buffered, resume at 512 KB) |
| **Integrity verification** | SHA-256 checksums computed on both sender and receiver sides |
| **Auto-expiring posts** | Posts are automatically cleaned up 5 minutes after the author goes offline |
| **No accounts required** | Peers are identified by ephemeral cryptographic IDs — no sign-up, no tracking |
| **Edge-deployed signaling** | Cloudflare Workers + Durable Objects for low-latency connection coordination worldwide |

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
│  │ - SignalingRoom    │  │  File data NEVER
│  │ - PostRegistry     │  │  passes through here
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Rust/WASM          │  │
│  │ - PeerID hashing   │  │
│  │ - File checksum    │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

The architecture separates concerns into three layers:

- **Frontend** — Vue 3 SPA that manages peer discovery, WebRTC negotiation, and file transfer UI
- **Signaling Worker** — Cloudflare Worker with Hono router and two Durable Objects for stateful WebSocket rooms and post storage
- **Crypto/WASM** — Rust crate compiled to WebAssembly for peer ID generation and SHA-256 checksums

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | [Vue 3](https://vuejs.org/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Pinia](https://pinia.vuejs.org/) |
| Signaling | [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Hono](https://hono.dev/), [Durable Objects](https://developers.cloudflare.com/durable-objects/) |
| Crypto/WASM | [Rust](https://www.rust-lang.org/), [wasm-bindgen](https://rustwasm.github.io/wasm-bindgen/), [sha2](https://docs.rs/sha2) |
| P2P | [WebRTC](https://webrtc.org/) (RTCPeerConnection, RTCDataChannel) |
| Package Manager | [pnpm](https://pnpm.io/) workspaces |
| Build | [wasm-pack](https://rustwasm.github.io/wasm-pack/) for Rust→WASM, Vite for frontend |

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10 (`npm install -g pnpm`)
- **Rust** toolchain with `wasm32-unknown-unknown` target
- **wasm-pack** — install with `cargo install wasm-pack`

To set up the Rust toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

### Installation

```bash
# Clone the repository
git clone https://github.com/LemonStudio-hub/edge-mesh.git
cd edge-mesh

# Install all dependencies (shared, frontend, worker)
pnpm install
```

### Build WASM

The Rust/WASM crypto module must be compiled before running the worker:

```bash
pnpm wasm:build
```

This compiles `packages/worker/src/wasm/edge-mesh-crypto/` to `packages/worker/pkg/` using wasm-pack.

### Development

Start the signaling worker (Cloudflare Worker dev server on port 8787):

```bash
pnpm worker:dev
```

In a separate terminal, start the Vue frontend dev server (port 5173):

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in two browser tabs to test P2P connections. The Vite dev server proxies `/api` requests to the worker.

### Production Deployment

Deploy the signaling worker to Cloudflare:

```bash
# Set your Cloudflare credentials
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
export CLOUDFLARE_API_TOKEN=<your-api-token>

# Deploy
pnpm worker:deploy
```

Build the frontend for static hosting:

```bash
pnpm build
# Output in packages/frontend/dist/
```

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions.

## How It Works

```
┌──────────┐     1. Create post     ┌──────────────┐
│  User A  │ ──────────────────────▶│ PostRegistry  │
│ (online) │                        │  (stores it)  │
└──────────┘                        └──────┬───────┘
                                           │
┌──────────┐     2. Discover post    ┌─────▼───────┐
│  User B  │ ◀──────────────────────│  GET /posts  │
│ (online) │                        └─────────────┘
└────┬─────┘
     │  3. Send connect-request
     │     via WebSocket
     ▼
┌──────────────┐     4. Accept        ┌──────────┐
│SignalingRoom │ ──────────────────▶  │  User A  │
│  (relay)     │     connect-accept    │ (accepts)│
└──────┬───────┘                      └──────────┘
       │
       │  5. WebRTC offer/answer/ICE
       │     exchange (relayed)
       ▼
┌──────────────────────────────────────────┐
│          WebRTC DataChannel              │
│    Browser ↔ Browser (direct P2P)        │
│                                          │
│  6. Drag-and-drop files for transfer     │
│     64KB chunks + SHA-256 verification   │
└──────────────────────────────────────────┘
```

1. **Publish** — While online, create a post visible to all peers on the network
2. **Discover** — The post board refreshes every 10 seconds, showing active peers
3. **Connect** — Click "Connect" on a peer's post to send a connection request
4. **Accept** — The target peer sees a confirmation dialog (30-second auto-reject timeout)
5. **Transfer** — After mutual confirmation, a WebRTC DataChannel opens for direct file transfer
6. **Auto-cleanup** — When a user goes offline, their posts are automatically removed after 5 minutes

## Project Structure

```
edge-mesh/
├── packages/
│   ├── shared/              # Shared TypeScript types and constants
│   │   └── src/
│   │       ├── types.ts     # Post, PeerInfo, FileMetadata, SignalMessage, FileTransferMessage
│   │       └── constants.ts # ICE config, STUN servers, chunk size, timeouts
│   │
│   ├── frontend/            # Vue 3 + Vite SPA
│   │   └── src/
│   │       ├── components/  # PostBoard, PostCard, FileDropZone, ConnectionRequest, etc.
│   │       ├── composables/ # useSignaling, useWebRTC, useFileTransfer, useOnlineStatus
│   │       ├── stores/      # peer, posts, session, transfer (Pinia)
│   │       └── views/       # HomeView (discovery), TransferView (P2P transfer)
│   │
│   └── worker/              # Cloudflare Worker (Hono + Durable Objects)
│       ├── src/
│       │   ├── routes/      # health, posts, signaling
│       │   ├── durable-objects/  # PostRegistry, SignalingRoom
│       │   └── wasm/edge-mesh-crypto/  # Rust crate for peer IDs and checksums
│       └── test/            # Vitest tests (cloudflare/vitest-pool-workers)
│
└── docs/
    ├── api.md               # REST and WebSocket API reference
    ├── architecture.md      # Detailed component and data flow documentation
    ├── deployment.md        # Production deployment guide
    └── development.md       # Development environment setup
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/api.md) | REST endpoints, WebSocket message protocol, request/response schemas |
| [Architecture](docs/architecture.md) | Component details, data flow, IPv6 strategy, file transfer protocol |
| [Deployment Guide](docs/deployment.md) | Cloudflare Worker deployment, frontend hosting, production configuration |
| [Development Guide](docs/development.md) | Development environment setup, debugging, testing, common workflows |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SIGNALING_URL` | WebSocket/HTTP base URL for the signaling worker | `http://localhost:8787` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (for deployment only) | — |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (for deployment only) | — |

Copy `.env.example` to `.env` and configure for your environment:

```bash
cp .env.example .env
```

## Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up your development environment
- Code style and conventions
- Submitting pull requests
- Reporting issues

Please also review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Security

EdgeMesh takes security seriously. If you discover a vulnerability, please report it responsibly. See our [Security Policy](SECURITY.md) for details on:

- Supported versions
- How to report vulnerabilities
- Security considerations for P2P applications

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

This means you are free to use, modify, and distribute this software, but if you run a modified version as a network service, you must make the source code available to users of that service.

See the [LICENSE](LICENSE) file for the full license text, or visit [gnu.org/licenses/agpl-3.0](https://www.gnu.org/licenses/agpl-3.0.html) for a summary.

---

<p align="center">
  Built with WebRTC, Cloudflare Workers, and Rust/WASM<br>
  <a href="https://file.ijk.cam">file.ijk.cam</a> · <a href="https://api.ijk.cam">api.ijk.cam</a>
</p>
