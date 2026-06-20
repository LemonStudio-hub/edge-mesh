/** STUN servers — IPv6 first, IPv4 fallback */
export const STUN_SERVERS: RTCIceServer[] = [
  // IPv6 STUN (Google)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Cloudflare STUN
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** ICE configuration with IPv6-first candidate filtering */
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: STUN_SERVERS,
  iceCandidatePoolSize: 2,
  iceTransportPolicy: 'all',
};

/** File transfer chunk size in bytes (64 KB) */
export const CHUNK_SIZE = 64 * 1024;

/** Time in ms before an offline user's posts are deleted (5 minutes) */
export const OFFLINE_POST_EXPIRY_MS = 5 * 60 * 1000;

/** Heartbeat interval to maintain online status (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Connection request timeout (30 seconds) */
export const CONNECTION_REQUEST_TIMEOUT_MS = 30 * 1000;

/** Maximum file size for transfer (1 GB) */
export const MAX_FILE_SIZE = 1024 * 1024 * 1024;

/** Data channel label */
export const DATA_CHANNEL_LABEL = 'edge-mesh-transfer';
