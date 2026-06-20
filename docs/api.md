# EdgeMesh API Reference

## REST Endpoints

### `GET /api/health`

Returns server health status.

**Response:**
```json
{ "status": "ok", "version": "0.1.0", "timestamp": 1718900000000 }
```

### `GET /api/posts`

List all active posts.

**Response:**
```json
[
  {
    "id": "uuid",
    "authorPeerId": "a1b2c3d4e5f6",
    "authorName": "Peer-a1b2c3",
    "content": "Hello from EdgeMesh!",
    "createdAt": 1718900000000,
    "expiresAt": 1718900300000
  }
]
```

### `POST /api/posts`

Create a new post.

**Request:**
```json
{
  "authorPeerId": "a1b2c3d4e5f6",
  "authorName": "Peer-a1b2c3",
  "content": "Sharing files today"
}
```

**Response:** `201 Created` with the post object.

### `DELETE /api/posts/:id`

Delete a post by ID.

**Response:** `{ "deleted": true }`

### `POST /api/posts/heartbeat`

Extend post expiry for an online peer.

**Request:**
```json
{ "peerId": "a1b2c3d4e5f6" }
```

**Response:** `{ "ok": true }`

## WebSocket: `/api/signal/:roomId`

Upgrade to WebSocket for real-time signaling.

### Client → Server Messages

**Register:**
```json
{ "type": "register", "peerId": "a1b2c3d4e5f6", "peerName": "Peer-a1b2c3" }
```

**Offer:**
```json
{ "type": "offer", "from": "peerA", "to": "peerB", "sdp": { ... } }
```

**Answer:**
```json
{ "type": "answer", "from": "peerB", "to": "peerA", "sdp": { ... } }
```

**ICE Candidate:**
```json
{ "type": "ice-candidate", "from": "peerA", "to": "peerB", "candidate": { ... } }
```

**Connection Request:**
```json
{ "type": "connect-request", "from": "peerA", "fromName": "Peer-a1b2c3" }
```

**Connection Response:**
```json
{ "type": "connect-accept", "from": "peerB" }
```

### Server → Client Messages

**Peer List (on register):**
```json
{ "type": "peer-list", "peers": [{ "peerId": "...", "name": "...", "isOnline": true }] }
```

**Peer Joined:**
```json
{ "type": "peer-joined", "peer": { "peerId": "...", "name": "...", "isOnline": true } }
```

**Peer Left:**
```json
{ "type": "peer-left", "peerId": "..." }
```

All signaling messages for offer/answer/ICE are relayed to the target peer as-is.
