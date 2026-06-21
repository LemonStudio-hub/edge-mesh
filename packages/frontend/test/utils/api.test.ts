import { describe, it, expect } from 'vitest';
import { apiUrl } from '@/utils/api.js';

describe('apiUrl', () => {
  it('prepends VITE_SIGNALING_URL to the path', () => {
    // In test environment, VITE_SIGNALING_URL is set to 'http://localhost:8787'
    const url = apiUrl('/api/posts');
    expect(url).toBe('http://localhost:8787/api/posts');
  });

  it('works with health endpoint', () => {
    expect(apiUrl('/api/health')).toBe('http://localhost:8787/api/health');
  });

  it('works with signal endpoint', () => {
    expect(apiUrl('/api/signal/room-1')).toBe('http://localhost:8787/api/signal/room-1');
  });

  it('works with heartbeat endpoint', () => {
    expect(apiUrl('/api/posts/heartbeat')).toBe('http://localhost:8787/api/posts/heartbeat');
  });
});
