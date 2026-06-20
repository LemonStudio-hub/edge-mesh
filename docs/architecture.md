# EdgeMesh Architecture

## Overview

EdgeMesh is a browser-side P2P file distribution network. Files transfer directly between browsers via WebRTC — the server only handles signaling and post coordination.

## Components

### Frontend (Vue 3)

- **Pinia Stores**: `peer` (identity, online status), `posts` (post feed), `transfer` (file transfer progress)
- **Composables**: `useSignaling` (WebSocket), `useWebRTC` (P2P), `useFileTransfer` (chunked send/receive), `useOnlineStatus` (visibility/network detection)
- **Components**: PostBoard, PostCard, CreatePost, ConnectionRequest, FileDropZone, TransferDialog, OnlineBadge

### Signaling Worker (Cloudflare Workers + Hono)

- **PostRegistry Durable Object**: Stores active posts, auto-expires posts 5 min after author goes offline (via alarm)
- **SignalingRoom Durable Object**: Manages WebSocket connections per room, relays offer/answer/ICE messages between peers
- **Hono Routes**: REST API for posts CRUD, WebSocket upgrade for signaling

### Crypto/WASM (Rust)

- **peer_id**: Generate unique peer IDs via SHA-256 hash with random salt
- **checksum**: SHA-256 file integrity verification (incremental + one-shot)

## Data Flow

```
1. User A creates post → POST /api/posts → PostRegistry stores it
2. User B sees post in feed → GET /api/posts → PostRegistry returns all
3. User B clicks "Connect" → sends connect-request via SignalingRoom
4. User A sees dialog → accepts → connect-accept sent back
5. Both create RTCPeerConnection → offer/answer/ICE exchange via SignalingRoom
6. WebRTC data channel opens → files transfer directly P2P
7. User A closes tab → heartbeat stops → PostRegistry deletes posts after 5 min
```

## IPv6-First Strategy

The ICE configuration prioritizes IPv6 STUN servers. The browser's ICE agent gathers IPv6 `srflx` candidates first, then IPv4. This improves NAT traversal success because:

- IPv6 has no NAT in most modern setups (direct connectivity)
- IPv6-to-IPv6 connections bypass NAT entirely
- IPv4 fallback via public STUN servers ensures compatibility

## File Transfer Protocol

Messages over `RTCDataChannel`:

1. `file-meta` — JSON: `{ name, size, type, totalChunks, checksum }`
2. `file-chunk` — Binary: chunk data (64 KB max)
3. `file-ack` — JSON: acknowledgment per chunk (flow control)
4. `file-complete` — JSON: final SHA-256 checksum
5. `file-cancel` — JSON: abort transfer

Flow control: sender waits when `bufferedAmount > 1 MB`, resumes at 512 KB.
