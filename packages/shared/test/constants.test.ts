import { describe, it, expect } from 'vitest';
import {
  STUN_SERVERS,
  ICE_CONFIG,
  CHUNK_SIZE,
  OFFLINE_POST_EXPIRY_MS,
  HEARTBEAT_INTERVAL_MS,
  CONNECTION_REQUEST_TIMEOUT_MS,
  MAX_FILE_SIZE,
  DATA_CHANNEL_LABEL,
} from '../src/constants.js';

describe('STUN_SERVERS', () => {
  it('contains at least one STUN server', () => {
    expect(STUN_SERVERS.length).toBeGreaterThan(0);
  });

  it('each entry has a urls field', () => {
    for (const server of STUN_SERVERS) {
      expect(server).toHaveProperty('urls');
      expect(typeof server.urls).toBe('string');
    }
  });

  it('uses stun: protocol', () => {
    for (const server of STUN_SERVERS) {
      expect(server.urls).toMatch(/^stun:/);
    }
  });
});

describe('ICE_CONFIG', () => {
  it('has iceServers array matching STUN_SERVERS', () => {
    expect(ICE_CONFIG.iceServers).toEqual(STUN_SERVERS);
  });

  it('has iceCandidatePoolSize of 2', () => {
    expect(ICE_CONFIG.iceCandidatePoolSize).toBe(2);
  });

  it('has iceTransportPolicy set to all', () => {
    expect(ICE_CONFIG.iceTransportPolicy).toBe('all');
  });
});

describe('CHUNK_SIZE', () => {
  it('equals 64 KB (65536 bytes)', () => {
    expect(CHUNK_SIZE).toBe(64 * 1024);
    expect(CHUNK_SIZE).toBe(65536);
  });
});

describe('OFFLINE_POST_EXPIRY_MS', () => {
  it('equals 5 minutes', () => {
    expect(OFFLINE_POST_EXPIRY_MS).toBe(5 * 60 * 1000);
    expect(OFFLINE_POST_EXPIRY_MS).toBe(300_000);
  });
});

describe('HEARTBEAT_INTERVAL_MS', () => {
  it('equals 30 seconds', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30 * 1000);
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });
});

describe('CONNECTION_REQUEST_TIMEOUT_MS', () => {
  it('equals 30 seconds', () => {
    expect(CONNECTION_REQUEST_TIMEOUT_MS).toBe(30 * 1000);
    expect(CONNECTION_REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});

describe('MAX_FILE_SIZE', () => {
  it('equals 1 GB', () => {
    expect(MAX_FILE_SIZE).toBe(1024 * 1024 * 1024);
    expect(MAX_FILE_SIZE).toBe(1_073_741_824);
  });
});

describe('DATA_CHANNEL_LABEL', () => {
  it('is edge-mesh-transfer', () => {
    expect(DATA_CHANNEL_LABEL).toBe('edge-mesh-transfer');
  });
});
