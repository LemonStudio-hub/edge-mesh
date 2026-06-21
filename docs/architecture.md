# EdgeMesh Architecture

This document describes the technical architecture of EdgeMesh, including component details, data flow, design decisions, and the file transfer protocol.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Components](#components)
  - [Frontend (Vue 3)](#frontend-vue-3)
  - [Signaling Worker (Cloudflare Workers)](#signaling-worker-cloudflare-workers)
  - [Crypto/WASM (Rust)](#cryptowasm-rust)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)
  - [IPv6-First ICE Strategy](#ipv6-first-ice-strategy)
  - [Mutual Confirmation](#mutual-confirmation)
  - [No Server in Data Path](#no-server-in-data-path)
  - [Ephemeral Peer IDs](#ephemeral-peer-ids)
- [File Transfer Protocol](#file-transfer-protocol)
  - [Transfer Lifecycle](#transfer-lifecycle)
  - [Chunk Format](#chunk-format)
  - [Flow Control](#flow-control)
  - [Integrity Verification](#integrity-verification)
- [State Management](#state-management)
- [Security Model](#security-model)

## Overview

EdgeMesh is a browser-side peer-to-peer file distribution network. The fundamental design principle is that **file data never touches the server**. The Cloudflare Worker handles only:

1. **Signaling** — Relaying WebRTC offer/answer/ICE candidates between peers
2. **Post coordination** — A lightweight bulletin board where peers announce themselves

All file transfer happens directly between browsers via WebRTC DataChannels, encrypted by DTLS/SRTP.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vue 3 Frontend                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Stores   │ │Composable│ │Components│ │ Router │ │
│  │ peer     │ │ signaling│ │ PostBoard│ │ /      │ │
│  │ posts    │ │ webrtc   │ │ FileDrop │ │ /transfer│
│  │ session  │ │ fileTxfr │ │ ConnReq  │ │        │ │
│  │ transfer │ │ online   │ │ Status   │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────┬──────────────────────┬────────────────┘
               │ WebSocket/HTTP       │ WebRTC DataChannel
               │ (signaling only)     │ (file data)
               ▼                      ▼
┌──────────────────────────┐  ┌───────────────────────┐
│  Cloudflare Worker       │  │  Browser ↔ Browser    │
│  ┌────────────────────┐  │  │  Direct P2P transfer  │
│  │ Hono Router        │  │  │                       │
│  │ /api/health        │  │  │  Encrypted by DTLS    │
│  │ /api/posts         │  │  │  64KB chunks          │
│  │ /api/signal/:room  │  │  │  SHA-256 verified     │
│  └────────────────────┘  │  └───────────────────────┘
│  ┌────────────────────┐  │
│  │ Durable Objects    │  │
│  │ PostRegistry       │  │  ← Stores posts, manages
│  │ SignalingRoom      │  │    heartbeats, handles
│  └────────────────────┘  │    WebSocket rooms
│  ┌────────────────────┐  │
│  │ Rust/WASM          │  │
│  │ peer_id            │  │  ← Peer ID generation
│  │ checksum           │  │    SHA-256 checksums
│  └────────────────────┘  │
└──────────────────────────┘
```

## Components

### Frontend (Vue 3)

The frontend is a Vue 3 SPA built with Vite. It handles peer discovery, WebRTC negotiation, and file transfer UI.

#### Pinia Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `usePeerStore` | `stores/peer.ts` | Ephemeral peer identity (16-char hex ID), display name, online/offline state, heartbeat management (30s interval), visibility tracking |
| `usePostsStore` | `stores/posts.ts` | Post CRUD operations, 10-second refresh polling |
| `useSessionStore` | `stores/session.ts` | Active P2P session orchestration, composable lifecycle management, connected peer info |
| `useTransferStore` | `stores/transfer.ts` | File transfer state tracking — progress (0-1), bytes transferred, speed, status (connecting/transferring/verifying/complete/error/cancelled) |

#### Composables

| Composable | File | Responsibility |
|------------|------|----------------|
| `useSignaling` | `composables/useSignaling.ts` | WebSocket connection to signaling server. Auto-reconnects every 3s on close. Maintains reactive peer list. Exposes `send()`, `onMessage()`, `connect()`, `disconnect()`. |
| `useWebRTC` | `composables/useWebRTC.ts` | RTCPeerConnection management. Creates DataChannels, handles offer/answer/ICE exchange. Tracks connection state reactively. |
| `useFileTransfer` | `composables/useFileTransfer.ts` | Chunked file send/receive. Reads files into ArrayBuffer, sends 64KB chunks with backpressure flow control, verifies SHA-256 checksums. |
| `useOnlineStatus` | `composables/useOnlineStatus.ts` | Tracks page visibility (`visibilitychange`) and network state (`online`/`offline` events). Toggles peer online status accordingly. |

#### Views

| View | Route | Description |
|------|-------|-------------|
| `HomeView` | `/` | Peer discovery page. Creates a shared signaling room (`"global"`), initializes WebRTC composable, handles incoming connection requests, navigates to `/transfer` on data channel open. |
| `TransferView` | `/transfer` | File transfer page. Redirects to home if no active session. Shows connection status, file drop zone, active transfers with progress, and received files with download buttons. |

#### Components

| Component | Description |
|-----------|-------------|
| `PostBoard` | Fetches posts on mount, refreshes every 10s, renders `PostCard` for each post |
| `PostCard` | Displays post author, content, time-ago, and a "Connect" button |
| `CreatePost` | Textarea + Publish button, disabled when offline |
| `ConnectionRequest` | Modal overlay for incoming connection requests with 30s auto-reject countdown |
| `ConnectionStatus` | Status bar showing peer name, connection state, elapsed time, disconnect button |
| `FileDropZone` | Drag-and-drop or browse file selector with 1 GB size validation |

### Signaling Worker (Cloudflare Workers + Hono)

The signaling worker is a Cloudflare Worker using the Hono router framework. It manages two Durable Objects for stateful operations.

#### Hono Routes

| Route | Method | Handler | Description |
|-------|--------|---------|-------------|
| `/api/health` | GET | `health.ts` | Returns `{ status, version, timestamp }` |
| `/api/posts` | GET | `posts.ts` | Proxies to PostRegistry DO — list active posts |
| `/api/posts` | POST | `posts.ts` | Proxies to PostRegistry DO — create post |
| `/api/posts/:id` | DELETE | `posts.ts` | Proxies to PostRegistry DO — delete post |
| `/api/posts/heartbeat` | POST | `posts.ts` | Proxies to PostRegistry DO — extend expiry |
| `/api/signal/:roomId` | GET | `signaling.ts` | WebSocket upgrade — forwards to SignalingRoom DO |

#### PostRegistry Durable Object

Manages the post bulletin board with automatic expiry.

**State:**
- `Map<string, Post>` — Active posts keyed by post ID
- `Map<string, number>` — Last heartbeat timestamp per peer

**Methods:**
- `GET /posts` — Cleanup expired posts, return sorted by `createdAt` descending
- `POST /posts` — Create post with UUID, 5-min expiry, schedule alarm
- `DELETE /posts/:id` — Delete post by ID
- `POST /heartbeat` — Extend `expiresAt` for all posts by the peer, update last heartbeat timestamp

**Alarm:**
- Runs every 60 seconds
- Removes posts where `expiresAt < now`
- Removes posts from peers silent for 5+ minutes
- Reschedules if posts remain

#### SignalingRoom Durable Object

Manages WebSocket connections for real-time signaling.

**State:**
- `Map<string, ConnectedPeer>` — Connected peers keyed by peer ID, each with a WebSocket reference

**Behavior:**
- On `register` message: Store peer, send `peer-list` to new peer, broadcast `peer-joined` to others
- On message with `to` field: Relay message directly to the target peer's WebSocket
- On WebSocket close/error: Remove peer, broadcast `peer-left`

### Crypto/WASM (Rust)

A Rust crate compiled to WebAssembly via wasm-pack, providing cryptographic primitives.

**Location:** `packages/worker/src/wasm/edge-mesh-crypto/`

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `generate_peer_id(seed)` | `&str` | `String` | SHA-256 hash of seed + 8 random salt bytes, returns first 8 bytes as 16-char hex |
| `compute_checksum(data)` | `&[u8]` | `String` | One-shot SHA-256, returns 64-char hex |
| `IncrementalChecksum.new()` | — | instance | Create streaming checksum instance |
| `.update(data)` | `&[u8]` | — | Feed data to the checksum |
| `.finalize()` | — | `String` | Finalize and return 64-char hex, resets for reuse |

**Dependencies:** `wasm-bindgen`, `sha2`, `hex`, `getrandom` (with `js` feature for browser compatibility)

## Data Flow

### Peer Discovery and Connection

```
┌──────────┐                    ┌──────────────┐                    ┌──────────┐
│  User A  │                    │  Signaling   │                    │  User B  │
│          │                    │  Worker      │                    │          │
└────┬─────┘                    └──────┬───────┘                    └────┬─────┘
     │                                 │                                 │
     │  1. POST /api/posts             │                                 │
     │ ───────────────────────────────▶│                                 │
     │                                 │  PostRegistry stores post       │
     │                                 │                                 │
     │                                 │          2. GET /api/posts      │
     │                                 │◀────────────────────────────────│
     │                                 │          Returns all posts      │
     │                                 │                                 │
     │                                 │  3. WebSocket connect-request   │
     │                                 │◀────────────────────────────────│
     │                                 │                                 │
     │      4. Relayed connect-request │                                 │
     │◀───────────────────────────────│                                 │
     │                                 │                                 │
     │  5. connect-accept              │                                 │
     │ ───────────────────────────────▶│                                 │
     │                                 │  6. Relayed connect-accept      │
     │                                 │───────────────────────────────▶│
     │                                 │                                 │
     │  7. WebRTC offer                │                                 │
     │ ───────────────────────────────▶│  Relayed                        │
     │                                 │───────────────────────────────▶│
     │                                 │                                 │
     │                                 │  8. WebRTC answer               │
     │                                 │◀────────────────────────────────│
     │◀───────────────────────────────│  Relayed                        │
     │                                 │                                 │
     │  9. ICE candidates (bidirectional relay)                          │
     │◀─────────────────────────────────────────────────────────────────▶│
     │                                 │                                 │
     │  10. WebRTC DataChannel opens                                    │
     │◀═════════════════════════════════════════════════════════════════▶│
     │         DIRECT P2P (no server)                                   │
```

### Post Lifecycle

```
User comes online
    │
    ▼
POST /api/posts ──▶ PostRegistry creates post
    │               expiresAt = now + 5min
    │               alarm scheduled (60s)
    │
    ▼
Every 30 seconds:
POST /api/posts/heartbeat ──▶ PostRegistry extends expiresAt
    │                          for all peer's posts
    │
    ▼
User closes tab
    │
    ▼
Heartbeats stop
    │
    ▼
After 5 minutes:
PostRegistry alarm fires ──▶ Removes expired posts
```

## Design Decisions

### IPv6-First ICE Strategy

The ICE configuration in `@edge-mesh/shared` prioritizes IPv6 STUN servers:

```typescript
export const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

export const ICE_CONFIG: RTCConfiguration = {
  iceServers: STUN_SERVERS.map(url => ({ urls: url })),
  iceCandidatePoolSize: 2,
  iceTransportPolicy: 'all',
};
```

**Why IPv6-first:**
- IPv6 has no NAT in most modern setups — peers get direct connectivity
- IPv6-to-IPv6 connections bypass NAT entirely, reducing connection setup time
- IPv4 fallback via public STUN servers ensures compatibility with older networks
- The browser's ICE agent gathers both IPv6 and IPv4 `srflx` candidates, preferring IPv6

**Trade-offs:**
- IPv6 connectivity is required on both peers for the preferred path
- If only IPv4 is available, the fallback path works but may have higher latency
- No TURN servers are configured — peers behind symmetric NATs may fail to connect

### Mutual Confirmation

Both peers must explicitly accept before a WebRTC connection is established. This prevents:

- Silent connection attempts from unknown peers
- Accidental connections when browsing the post board
- Social engineering attacks that rely on automatic acceptance

**Implementation:**
1. Peer A sends `connect-request` via WebSocket
2. Peer B sees a modal dialog with the requester's name
3. Peer B has 30 seconds to accept or reject
4. If no response, the request auto-rejects
5. On accept, WebRTC negotiation begins

### No Server in Data Path

File bytes never touch the Cloudflare Worker. This provides:

- **Privacy** — The server operator cannot see file contents
- **Cost** — No bandwidth costs for file transfer (only signaling traffic)
- **Performance** — Direct browser-to-browser transfer with no relay bottleneck
- **Scalability** — File transfer capacity scales with peer bandwidth, not server capacity

**Trade-offs:**
- Peers must be able to establish a direct WebRTC connection
- Corporate firewalls or symmetric NATs may block P2P connections
- No TURN server fallback means some peer pairs cannot connect

### Ephemeral Peer IDs

Peer IDs are generated randomly on each session using `crypto.getRandomValues`. There is no persistent identity, account system, or tracking.

**Benefits:**
- No personal data collection
- No account management overhead
- Each session is independent

**Trade-offs:**
- No reputation system or trust scoring
- No way to reconnect to the same peer after a session ends
- No persistent file sharing history

## File Transfer Protocol

### Transfer Lifecycle

```
Sender                              Receiver
  │                                    │
  │  1. file-meta (JSON)               │
  │ ─────────────────────────────────▶ │
  │                                    │  Allocates buffer
  │  2. file-chunk [0] (Binary)        │
  │ ─────────────────────────────────▶ │
  │  3. file-chunk [1] (Binary)        │
  │ ─────────────────────────────────▶ │
  │         ...                        │
  │  N. file-chunk [N-1] (Binary)      │
  │ ─────────────────────────────────▶ │
  │                                    │  Verifies checksum
  │  N+1. file-complete (JSON)         │
  │ ─────────────────────────────────▶ │
  │                                    │  File ready for download
```

### Chunk Format

Each file is divided into chunks of 64 KB (65,536 bytes):

- **Chunk size**: `CHUNK_SIZE = 65536` bytes (defined in `@edge-mesh/shared`)
- **Last chunk**: May be smaller than 64 KB
- **Total chunks**: `Math.ceil(fileSize / CHUNK_SIZE)`
- **Encoding**: Raw `ArrayBuffer` via `RTCDataChannel.send()`

The `file-meta` message is sent as a JSON string. Subsequent chunks are sent as binary `ArrayBuffer` objects. The `file-complete` message is sent as a JSON string.

### Flow Control

The sender implements backpressure to prevent overwhelming the DataChannel:

```
sendChunk(chunk):
    if dataChannel.bufferedAmount > 1MB:
        wait until bufferedAmount < 512KB
    dataChannel.send(chunk)
```

**Thresholds:**
- **Pause**: `bufferedAmount > 1,048,576` (1 MB)
- **Resume**: `bufferedAmount < 524,288` (512 KB)

This prevents:
- Memory exhaustion on the sender (buffered data)
- Packet loss on the receiver (overwhelmed processing)
- Browser tab crashes from excessive memory usage

### Integrity Verification

SHA-256 checksums ensure file integrity:

1. **Sender** computes checksum using Web Crypto API (`crypto.subtle.digest('SHA-256', fileBuffer)`)
2. Checksum is included in both `file-meta` and `file-complete` messages
3. **Receiver** computes checksum of the reassembled file
4. Receiver compares computed vs. received checksum
5. Mismatch → transfer marked as error with "Checksum mismatch" message

The Web Crypto API provides hardware-accelerated SHA-256 in all modern browsers.

## State Management

### Frontend State Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ usePeerStore │────▶│useSessionStore│────▶│useTransferStore│
│ (identity)   │     │ (orchestration)│     │ (file progress)│
└──────┬──────┘     └──────┬───────┘     └──────────────┘
       │                   │
       │            ┌──────▼───────┐
       │            │useSignaling  │
       │            │ (WebSocket)  │
       │            └──────┬───────┘
       │                   │
       │            ┌──────▼───────┐
       └───────────▶│ useWebRTC    │
                    │ (P2P connect)│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │useFileTransfer│
                    │ (chunked I/O) │
                    └──────────────┘
```

The `useSessionStore` orchestrates the composables. It:
1. Creates signaling and WebRTC composable instances
2. Sets up a 500ms polling interval to sync reactive state
3. Manages the connected peer info
4. Handles disconnect/cleanup

### Worker State

**PostRegistry** (in-memory):
- `posts: Map<string, Post>` — Active posts
- `lastHeartbeat: Map<string, number>` — Peer heartbeat timestamps
- Alarm-based cleanup every 60 seconds

**SignalingRoom** (in-memory):
- `peers: Map<string, ConnectedPeer>` — Connected WebSocket peers
- No persistent state — room is empty when all peers disconnect

## Security Model

### Transport Security

- **WebRTC**: All DataChannel traffic is encrypted with DTLS/SRTP (built into the WebRTC specification)
- **WebSocket**: Signaling uses WSS (WebSocket over TLS) in production
- **REST API**: HTTPS in production

### Access Control

- **CORS**: Worker accepts requests only from the authorized frontend origin
- **Mutual confirmation**: Both peers must accept before connection
- **No authentication**: Peers are identified by ephemeral IDs only

### Data Protection

- **No server-side file storage**: File data never touches the server
- **No persistent identity**: Peer IDs are random and session-scoped
- **No tracking**: No cookies, no analytics, no user accounts

### Limitations

- **No application-layer encryption beyond WebRTC**: The browser's WebRTC implementation handles encryption
- **Metadata visibility**: The signaling server can observe which peers connect and when
- **No content filtering**: Users are responsible for the content they share
- **No TURN fallback**: Peers behind restrictive NATs may not connect
