# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2024-06-21

### Added

#### Frontend (`@edge-mesh/frontend`)
- Vue 3 SPA with Vue Router and Pinia state management
- **HomeView** — Peer discovery page with post board and connection requests
- **TransferView** — Dedicated file transfer page after P2P connection
- **PostBoard** / **PostCard** — Real-time post feed with 10-second polling
- **CreatePost** — Post creation with offline-aware disabled state
- **ConnectionRequest** — Modal dialog for incoming connection requests with 30-second auto-reject countdown
- **ConnectionStatus** — Status bar showing peer name, connection state, elapsed time, and disconnect button
- **FileDropZone** — Drag-and-drop file selection with 1 GB size validation
- **TransferDialog** — Active transfer panel with progress bars, speed display, and cancel/remove controls
- **OnlineBadge** — Online/offline indicator
- **Pinia stores**:
  - `usePeerStore` — Ephemeral peer identity, heartbeat management, visibility/online detection
  - `usePostsStore` — Post CRUD operations with 10-second refresh
  - `useSessionStore` — P2P session orchestration, composable lifecycle management
  - `useTransferStore` — File transfer state tracking (progress, speed, status)
- **Composables**:
  - `useSignaling` — WebSocket connection to signaling server with auto-reconnect
  - `useWebRTC` — RTCPeerConnection management with IPv6-first ICE strategy
  - `useFileTransfer` — Chunked file transfer with 64 KB chunks, backpressure flow control, and SHA-256 verification
  - `useOnlineStatus` — Page visibility and network online/offline tracking
- Vite dev server with `/api` proxy to worker (port 8787)
- CSS custom properties design system (colors, radius, shadows)

#### Worker (`@edge-mesh/worker`)
- Cloudflare Worker with Hono router
- **PostRegistry Durable Object** — In-memory post storage with alarm-based expiry (60-second cleanup cycle)
- **SignalingRoom Durable Object** — WebSocket room management with peer registration, message relay, and broadcast
- **REST API**:
  - `GET /api/health` — Health check endpoint
  - `GET /api/posts` — List active posts (sorted by creation time)
  - `POST /api/posts` — Create a post
  - `DELETE /api/posts/:id` — Delete a post
  - `POST /api/posts/heartbeat` — Extend post expiry
- **WebSocket API** (`/api/signal/:roomId`):
  - `register` — Peer registration with ID and display name
  - `offer` / `answer` / `ice-candidate` — WebRTC negotiation relay
  - `connect-request` / `connect-accept` — Connection request flow
  - `peer-list` / `peer-joined` / `peer-left` — Peer presence notifications
- CORS middleware restricted to authorized frontend origin

#### Shared (`@edge-mesh/shared`)
- TypeScript type definitions: `Post`, `PeerInfo`, `FileMetadata`, `FileChunk`, `SignalMessage`, `FileTransferMessage`
- Constants: `STUN_SERVERS`, `ICE_CONFIG`, `CHUNK_SIZE` (64 KB), `OFFLINE_POST_EXPIRY_MS` (5 min), `HEARTBEAT_INTERVAL_MS` (30 s), `CONNECTION_REQUEST_TIMEOUT_MS` (30 s), `MAX_FILE_SIZE` (1 GB), `DATA_CHANNEL_LABEL`
- IPv6-first ICE configuration with IPv4 STUN fallback

#### Crypto/WASM (`edge-mesh-crypto`)
- Rust crate compiled to WebAssembly via wasm-pack
- `generate_peer_id(seed)` — SHA-256-based peer ID generation with random salt
- `compute_checksum(data)` — One-shot SHA-256 checksum
- `IncrementalChecksum` — Streaming checksum with `update()` and `finalize()` methods

#### Documentation
- README with architecture diagram, features, quick start guide, and project structure
- API reference (REST endpoints and WebSocket message protocol)
- Architecture documentation (components, data flow, IPv6 strategy, file transfer protocol)
- Development guide
- Deployment guide
- Contributing guide
- Code of Conduct (Contributor Covenant v2.1)
- Security policy

### Security
- CORS restricted to `https://file.ijk.cam`
- Mutual confirmation required for WebRTC connections
- SHA-256 integrity verification for all file transfers
- Ephemeral peer IDs (no persistent tracking)

[0.1.0]: https://github.com/LemonStudio-hub/edge-mesh/releases/tag/v0.1.0
