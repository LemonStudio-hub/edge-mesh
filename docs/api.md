# EdgeMesh API Reference

This document describes the REST API and WebSocket signaling protocol used by EdgeMesh.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [REST Endpoints](#rest-endpoints)
  - [Health Check](#health-check)
  - [List Posts](#list-posts)
  - [Create Post](#create-post)
  - [Delete Post](#delete-post)
  - [Heartbeat](#heartbeat)
- [WebSocket Signaling](#websocket-signaling)
  - [Connection](#connection)
  - [Client-to-Server Messages](#client-to-server-messages)
  - [Server-to-Client Messages](#server-to-client-messages)
  - [Message Relay](#message-relay)
- [File Transfer Protocol](#file-transfer-protocol)
  - [DataChannel Messages](#datachannel-messages)
  - [Flow Control](#flow-control)
  - [Integrity Verification](#integrity-verification)
- [Error Handling](#error-handling)

## Base URL

| Environment | URL |
|-------------|-----|
| Local development | `http://localhost:8787` |
| Production | `https://api.ijk.cam` |

All REST endpoints are prefixed with `/api`.

## Authentication

The EdgeMesh API does not require authentication. Peers are identified by ephemeral peer IDs generated client-side. There are no accounts, tokens, or sessions.

CORS is enforced to restrict API access to the authorized frontend origin.

## REST Endpoints

### Health Check

Check if the signaling worker is running.

```
GET /api/health
```

**Response**  `200 OK`

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": 1718900000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"ok"` when the worker is healthy |
| `version` | `string` | Current API version |
| `timestamp` | `number` | Server time in Unix milliseconds |

---

### List Posts

Retrieve all active posts from the bulletin board.

```
GET /api/posts
```

**Response**  `200 OK`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "authorPeerId": "e4f5a6b7c8d90123",
    "authorName": "Peer-e4f5a6",
    "content": "Sharing files today!",
    "createdAt": 1718900000000,
    "expiresAt": 1718900300000
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique post ID (UUID) |
| `authorPeerId` | `string` | 16-character hex peer ID of the author |
| `authorName` | `string` | Display name of the author |
| `content` | `string` | Post content (user-authored text) |
| `createdAt` | `number` | Creation time in Unix milliseconds |
| `expiresAt` | `number` | Expiry time in Unix milliseconds (5 minutes after last heartbeat) |

**Notes:**
- Posts are sorted by `createdAt` in descending order (newest first)
- Expired posts are automatically cleaned up before returning results
- The response array may be empty if no peers have active posts

---

### Create Post

Create a new post on the bulletin board.

```
POST /api/posts
```

**Request Body**

```json
{
  "authorPeerId": "e4f5a6b7c8d90123",
  "authorName": "Peer-e4f5a6",
  "content": "Sharing files today!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `authorPeerId` | `string` | Yes | 16-character hex peer ID |
| `authorName` | `string` | Yes | Display name (typically `Peer-XXXXXX`) |
| `content` | `string` | Yes | Post content |

**Response**  `201 Created`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "authorPeerId": "e4f5a6b7c8d90123",
  "authorName": "Peer-e4f5a6",
  "content": "Sharing files today!",
  "createdAt": 1718900000000,
  "expiresAt": 1718900300000
}
```

**Notes:**
- The post expires 5 minutes after creation (extended by heartbeats)
- A heartbeat record is automatically created for the peer
- An alarm is scheduled for automatic cleanup

---

### Delete Post

Delete a post by its ID.

```
DELETE /api/posts/:id
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The post ID to delete |

**Response**  `200 OK`

```json
{
  "deleted": true
}
```

**Notes:**
- Returns `200` with `{ "deleted": true }` even if the post doesn't exist (idempotent)
- Only the post author should delete their own posts (enforced client-side)

---

### Heartbeat

Extend the expiry of all posts by a peer. Sent periodically (every 30 seconds) while the peer is online.

```
POST /api/posts/heartbeat
```

**Request Body**

```json
{
  "peerId": "e4f5a6b7c8d90123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `peerId` | `string` | Yes | The peer ID whose posts should be extended |

**Response**  `200 OK`

```json
{
  "ok": true
}
```

**Notes:**
- Extends the `expiresAt` of all posts by this peer by 5 minutes from now
- Updates the peer's last heartbeat timestamp
- If a peer stops sending heartbeats, their posts will expire after 5 minutes

## WebSocket Signaling

### Connection

Connect to the signaling WebSocket for real-time peer communication.

```
GET /api/signal/:roomId
```

This endpoint upgrades the HTTP connection to WebSocket. The `roomId` parameter identifies the signaling room.

**Room IDs:**
- The default room is `"global"` — all peers join this room for discovery
- Room IDs are arbitrary strings; the frontend uses `"global"` as a shared room

**Connection Flow:**
1. Client opens WebSocket to `/api/signal/global`
2. On open, client sends a `register` message
3. Server responds with `peer-list` containing all currently connected peers
4. Server broadcasts `peer-joined` to all other peers in the room

---

### Client-to-Server Messages

All messages are JSON-encoded strings sent via `WebSocket.send()`.

#### Register

Register the peer with the signaling room. Must be sent immediately after connection.

```json
{
  "type": "register",
  "peerId": "e4f5a6b7c8d90123",
  "peerName": "Peer-e4f5a6"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"register"` | Message type |
| `peerId` | `string` | 16-character hex peer ID |
| `peerName` | `string` | Display name |

#### Offer

Send a WebRTC SDP offer to a specific peer.

```json
{
  "type": "offer",
  "from": "e4f5a6b7c8d90123",
  "to": "a1b2c3d4e5f67890",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- ..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"offer"` | Message type |
| `from` | `string` | Sender's peer ID |
| `to` | `string` | Recipient's peer ID |
| `sdp` | `RTCSessionDescriptionInit` | WebRTC SDP offer |

#### Answer

Send a WebRTC SDP answer in response to an offer.

```json
{
  "type": "answer",
  "from": "a1b2c3d4e5f67890",
  "to": "e4f5a6b7c8d90123",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- ..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"answer"` | Message type |
| `from` | `string` | Sender's peer ID |
| `to` | `string` | Recipient's peer ID |
| `sdp` | `RTCSessionDescriptionInit` | WebRTC SDP answer |

#### ICE Candidate

Send a WebRTC ICE candidate to a specific peer.

```json
{
  "type": "ice-candidate",
  "from": "e4f5a6b7c8d90123",
  "to": "a1b2c3d4e5f67890",
  "candidate": {
    "candidate": "candidate:1 1 UDP 2122260223 ...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"ice-candidate"` | Message type |
| `from` | `string` | Sender's peer ID |
| `to` | `string` | Recipient's peer ID |
| `candidate` | `RTCIceCandidateInit` | WebRTC ICE candidate |

#### Connection Request

Request to establish a P2P connection with another peer.

```json
{
  "type": "connect-request",
  "from": "e4f5a6b7c8d90123",
  "fromName": "Peer-e4f5a6"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"connect-request"` | Message type |
| `from` | `string` | Requester's peer ID |
| `fromName` | `string` | Requester's display name |

**Notes:**
- This message is broadcast to all peers in the room (not targeted)
- The recipient sees a confirmation dialog with a 30-second auto-reject timer

#### Connection Accept

Accept an incoming connection request.

```json
{
  "type": "connect-accept",
  "from": "a1b2c3d4e5f67890",
  "to": "e4f5a6b7c8d90123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"connect-accept"` | Message type |
| `from` | `string` | Accepter's peer ID |
| `to` | `string` | Requester's peer ID |

**Notes:**
- After acceptance, the requester initiates WebRTC negotiation by sending an `offer`

---

### Server-to-Client Messages

These messages are sent by the signaling server to connected clients.

#### Peer List

Sent to a newly registered peer containing all currently connected peers.

```json
{
  "type": "peer-list",
  "peers": [
    {
      "peerId": "a1b2c3d4e5f67890",
      "name": "Peer-a1b2c3",
      "isOnline": true
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"peer-list"` | Message type |
| `peers` | `PeerInfo[]` | Array of connected peers |

#### Peer Joined

Broadcast to all existing peers when a new peer registers.

```json
{
  "type": "peer-joined",
  "peer": {
    "peerId": "e4f5a6b7c8d90123",
    "name": "Peer-e4f5a6",
    "isOnline": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"peer-joined"` | Message type |
| `peer` | `PeerInfo` | The peer that joined |

#### Peer Left

Broadcast to all remaining peers when a peer disconnects.

```json
{
  "type": "peer-left",
  "peerId": "e4f5a6b7c8d90123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"peer-left"` | Message type |
| `peerId` | `string` | The peer ID that disconnected |

---

### Message Relay

Any message with a `to` field is relayed directly to the target peer by the `SignalingRoom` Durable Object. This enables the `offer`, `answer`, `ice-candidate`, and `connect-accept` messages to be delivered peer-to-peer through the signaling server.

The server does not inspect or modify relayed message payloads — it only reads the `to` field to determine the recipient.

## File Transfer Protocol

File transfer occurs over `RTCDataChannel` after a WebRTC connection is established. The DataChannel label is `"edge-mesh-transfer"`.

### DataChannel Messages

Messages are either JSON strings or raw binary (`ArrayBuffer`).

#### file-meta (JSON)

Sent before file transfer begins to describe the file.

```json
{
  "type": "file-meta",
  "name": "document.pdf",
  "size": 1048576,
  "type": "application/pdf",
  "totalChunks": 16,
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"file-meta"` | Message type |
| `name` | `string` | Original file name |
| `size` | `number` | File size in bytes |
| `type` | `string` | MIME type |
| `totalChunks` | `number` | Total number of chunks |
| `checksum` | `string` | SHA-256 checksum of the complete file (64-char hex) |

#### file-chunk (Binary)

A raw `ArrayBuffer` containing file data. Maximum chunk size is 64 KB (65,536 bytes).

```
[ArrayBuffer: chunk data]
```

#### file-ack (JSON)

Acknowledgment sent by the receiver after processing a chunk (used for flow control).

```json
{
  "type": "file-ack",
  "chunkIndex": 5
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"file-ack"` | Message type |
| `chunkIndex` | `number` | Index of the acknowledged chunk |

#### file-complete (JSON)

Sent by the sender after all chunks have been transmitted.

```json
{
  "type": "file-complete",
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"file-complete"` | Message type |
| `checksum` | `string` | SHA-256 checksum for verification |

#### file-cancel (JSON)

Sent by either peer to abort the transfer.

```json
{
  "type": "file-cancel",
  "reason": "User cancelled"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"file-cancel"` | Message type |
| `reason` | `string` | Optional reason for cancellation |

### Flow Control

The sender implements backpressure to prevent overwhelming the receiver:

1. **Pause threshold**: When `dataChannel.bufferedAmount > 1 MB` (1,048,576 bytes), the sender pauses sending chunks
2. **Resume threshold**: When `dataChannel.bufferedAmount` drops below 512 KB (524,288 bytes), the sender resumes
3. **Monitoring**: The sender checks `bufferedAmount` before each chunk send

This prevents memory exhaustion on either side and ensures smooth transfer even on slow connections.

### Integrity Verification

Files are verified using SHA-256 checksums:

1. **Sender**: Computes the SHA-256 checksum of the entire file before transfer using the Web Crypto API
2. **Sender**: Includes the checksum in the `file-meta` message
3. **Sender**: Includes the same checksum in the `file-complete` message
4. **Receiver**: Computes the SHA-256 checksum of the reassembled file
5. **Receiver**: Compares the computed checksum against the received checksum
6. **Result**: If checksums match, the file is verified; otherwise, an error is reported

## Error Handling

### HTTP Error Responses

| Status Code | Description |
|-------------|-------------|
| `400` | Bad request — invalid JSON or missing required fields |
| `404` | Not found — post ID doesn't exist |
| `405` | Method not allowed |
| `500` | Internal server error |

### WebSocket Errors

- If the WebSocket connection is closed unexpectedly, the frontend automatically reconnects every 3 seconds
- If a `register` message is not sent after connection, the server will not relay messages to that peer
- Messages sent to a non-existent peer ID are silently dropped

### File Transfer Errors

- **Checksum mismatch**: If the receiver's computed checksum doesn't match the sender's checksum, the transfer is marked as failed
- **Connection drop**: If the WebRTC DataChannel closes during transfer, the transfer is marked as cancelled
- **Size limit**: Files larger than 1 GB are rejected client-side before transfer begins
