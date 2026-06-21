import { describe, it, expect } from 'vitest';
import { isAllowedOrigin } from '../src/middleware/cors.js';

describe('isAllowedOrigin', () => {
  it('returns true for the authorized frontend origin', () => {
    expect(isAllowedOrigin('https://file.ijk.cam')).toBe(true);
  });

  it('returns false for an unauthorized origin', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isAllowedOrigin('')).toBe(false);
  });

  it('returns false for http variant of the allowed origin', () => {
    expect(isAllowedOrigin('http://file.ijk.cam')).toBe(false);
  });

  it('returns false for a subdomain of the allowed origin', () => {
    expect(isAllowedOrigin('https://sub.file.ijk.cam')).toBe(false);
  });
});
