// CORS is handled by hono/cors in index.ts
// This file exists as a placeholder for custom CORS logic if needed

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return origin === 'https://file.ijk.cam';
}
