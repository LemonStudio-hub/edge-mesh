/** Base URL for the signaling/API worker */
const API_BASE = import.meta.env.VITE_SIGNALING_URL || '';

/**
 * Build a full API URL. In production this points to the Worker;
 * in dev the Vite proxy handles `/api` so we use relative paths.
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
