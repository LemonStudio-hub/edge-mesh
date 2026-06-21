# Deployment Guide

This guide covers deploying EdgeMesh to production, including the Cloudflare Worker (signaling server) and the Vue frontend.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Deploying the Signaling Worker](#deploying-the-signaling-worker)
- [Deploying the Frontend](#deploying-the-frontend)
- [Environment Configuration](#environment-configuration)
- [Custom Domain Setup](#custom-domain-setup)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Production Considerations](#production-considerations)

## Architecture Overview

EdgeMesh has two deployable components:

| Component | Platform | Description |
|-----------|----------|-------------|
| **Signaling Worker** | Cloudflare Workers | Handles WebSocket signaling, post coordination, and Durable Objects |
| **Frontend** | Any static host | Vue 3 SPA that connects to the signaling worker |

The signaling worker is deployed to Cloudflare's edge network, running in 300+ locations worldwide. The frontend is a static build that can be hosted on any CDN or static hosting service.

## Prerequisites

### Cloudflare Account

You need a Cloudflare account with:

- **Workers Paid plan** — Required for Durable Objects (the free tier has limited Durable Object support)
- **API Token** — With `Workers Scripts: Edit` and `Durable Objects: Edit` permissions

### Creating a Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template, or create a custom token with:
   - `Account > Workers Scripts > Edit`
   - `Account > Durable Objects > Edit`
4. Copy the token — you'll need it for deployment

## Deploying the Signaling Worker

### 1. Set Environment Variables

Export your Cloudflare credentials:

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
export CLOUDFLARE_API_TOKEN=<your-api-token>
```

Or create a `.env` file in the project root (already in `.gitignore`):

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_API_TOKEN=<your-api-token>
```

### 2. Build the WASM Module

The WASM crypto module must be compiled before deploying the worker:

```bash
pnpm wasm:build
```

### 3. Deploy

```bash
pnpm worker:deploy
```

This runs `wrangler deploy` in the `packages/worker` directory. The output will show:

```
Uploaded edge-mesh-signaling (X.XX sec)
Published edge-mesh-signaling (X.XX sec)
  https://edge-mesh-signaling.<your-subdomain>.workers.dev
```

### 4. Verify Deployment

Test the health endpoint:

```bash
curl https://edge-mesh-signaling.<your-subdomain>.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","version":"0.1.0","timestamp":1718900000000}
```

## Deploying the Frontend

### 1. Configure the Production API URL

Edit `packages/frontend/.env.production`:

```bash
VITE_SIGNALING_URL=https://edge-mesh-signaling.<your-subdomain>.workers.dev
```

Or, if using a custom domain for the worker:

```bash
VITE_SIGNALING_URL=https://api.your-domain.com
```

### 2. Build

```bash
pnpm build
```

The frontend build output is in `packages/frontend/dist/`.

### 3. Deploy to a Static Host

The frontend is a standard static SPA. Deploy the contents of `packages/frontend/dist/` to any static hosting provider:

#### Cloudflare Pages

```bash
# Using Wrangler
cd packages/frontend
npx wrangler pages deploy dist --project-name=edge-mesh
```

#### Netlify

```bash
# Create a netlify.toml in the frontend directory
cd packages/frontend
netlify deploy --prod --dir=dist
```

#### Vercel

```bash
cd packages/frontend
vercel --prod
```

#### GitHub Pages / Any Static Host

Upload the contents of `packages/frontend/dist/` to your hosting provider. Ensure the server is configured to:

- Serve `index.html` for all routes (SPA fallback)
- Set proper caching headers for assets in `/assets/`

### SPA Routing Configuration

Since EdgeMesh uses Vue Router in history mode, your static host must serve `index.html` for all routes. Here are configurations for common hosts:

**Nginx:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Apache (.htaccess):**
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

**Cloudflare Pages:** SPA routing is handled automatically.

## Environment Configuration

### Worker Environment

The worker uses Cloudflare's `wrangler.toml` for configuration. Key settings:

```toml
name = "edge-mesh-signaling"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "POST_REGISTRY"
class_name = "PostRegistry"

[[durable_objects.bindings]]
name = "SIGNALING_ROOM"
class_name = "SignalingRoom"
```

Durable Objects are automatically provisioned when the worker is deployed. No additional configuration is needed.

### Frontend Environment

| Variable | Description | Production Value |
|----------|-------------|------------------|
| `VITE_SIGNALING_URL` | Base URL for the signaling worker API | `https://api.ijk.cam` (or your worker URL) |

The `VITE_SIGNALING_URL` is baked into the frontend at build time. It must be set before running `pnpm build`.

## Custom Domain Setup

### Worker Custom Domain

To serve the worker from a custom domain (e.g., `api.your-domain.com`):

1. Add your domain to Cloudflare
2. In the Cloudflare Dashboard, go to **Workers & Pages**
3. Select your worker → **Settings** → **Triggers** → **Custom Domains**
4. Add your custom domain (e.g., `api.your-domain.com`)
5. Cloudflare will automatically configure DNS

### Frontend Custom Domain

Configure your static hosting provider to serve the frontend from your desired domain (e.g., `file.your-domain.com`).

### CORS Configuration

The worker's CORS is hardcoded to allow the production frontend origin. If you're using custom domains, update the CORS origin in `packages/worker/src/index.ts`:

```typescript
app.use('/*', cors({
  origin: ['https://file.your-domain.com'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))
```

## Monitoring and Maintenance

### Cloudflare Analytics

Cloudflare provides built-in analytics for Workers:

1. Go to **Workers & Pages** in the Cloudflare Dashboard
2. Select your worker
3. View **Metrics** for request volume, latency, and error rates

### Durable Object Monitoring

Durable Objects are monitored through the Cloudflare Dashboard:

1. Go to **Workers & Pages** → **Durable Objects**
2. View storage usage and request metrics for `PostRegistry` and `SignalingRoom`

### Log Access

For production debugging, use Cloudflare's log streaming:

```bash
# Tail worker logs in real-time
npx wrangler tail edge-mesh-signaling
```

### Alarms

The `PostRegistry` Durable Object uses alarms for automatic cleanup. The alarm runs every 60 seconds and:

- Removes posts that have expired (5 minutes after last heartbeat)
- Removes posts from peers that haven't sent a heartbeat in 5+ minutes
- Reschedules itself if posts remain

No manual intervention is needed — alarms are automatically managed by the Durable Object runtime.

## Production Considerations

### CORS

The worker's CORS configuration is restricted to the authorized frontend origin. This prevents unauthorized domains from accessing the API. If you deploy to custom domains, update the CORS origin in the worker source code and redeploy.

### Rate Limiting

Cloudflare Workers have built-in rate limiting at the account level. For additional protection:

- Consider using [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) rules
- The worker itself does not implement rate limiting — add it if needed for your use case

### Durable Object Limits

Be aware of Cloudflare Durable Object limits:

- **Storage**: 1 GB per Durable Object (not an issue — PostRegistry uses in-memory Maps)
- **Hibernation**: Durable Objects can hibernate when idle, reducing costs
- **Alarm frequency**: Minimum 1-minute alarm interval

### WebRTC Considerations

- **STUN servers**: The default configuration uses Google and Cloudflare STUN servers. For high-traffic deployments, consider running your own STUN/TURN servers.
- **TURN servers**: The current configuration does not include TURN servers. Peers behind symmetric NATs may not be able to connect. Add TURN servers to `ICE_CONFIG` in `packages/shared/src/constants.ts` if needed.
- **Firewall requirements**: WebRTC requires UDP connectivity. Corporate firewalls that block UDP will prevent P2P connections.

### Scaling

- **Cloudflare Workers** scale automatically — no capacity planning needed
- **Durable Objects** scale per-instance — each room is an independent DO instance
- **Frontend** scales with your static hosting provider's CDN

### Cost Estimation

Cloudflare Workers pricing (as of 2024):

| Resource | Free Tier | Paid Plan |
|----------|-----------|-----------|
| Requests | 100,000/day | 10 million/month + $0.30/million |
| CPU time | 10ms/request | 30s/request (50ms free) |
| Durable Objects | 1M reads + 1K writes/day | $0.20/million reads, $1.00/million writes |
| Durable Object storage | 1 GB | $0.20/GB-month |

For most small-to-medium deployments, the free tier or the $5/month Workers Paid plan is sufficient.
