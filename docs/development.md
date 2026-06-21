# Development Guide

This guide covers everything you need to set up a local development environment for EdgeMesh, understand the development workflow, and debug effectively.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Package Details](#package-details)
- [Debugging](#debugging)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [IDE Setup](#ide-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | >= 18 | JavaScript runtime |
| [pnpm](https://pnpm.io/) | >= 10 | Package manager with workspace support |
| [Rust](https://www.rust-lang.org/) | stable | For the WASM crypto module |
| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | latest | Compiles Rust to WebAssembly |

### Optional

| Tool | Purpose |
|------|---------|
| [Wrangler](https://developers.cloudflare.com/wrangler/) | Cloudflare Worker CLI (installed as dev dependency) |
| [Cloudflare account](https://dash.cloudflare.com/) | Required for worker deployment |

### Installing Rust and wasm-pack

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack
```

The project includes a `rust-toolchain.toml` that pins the stable channel and `wasm32-unknown-unknown` target, so `rustup` will automatically configure the correct toolchain.

## Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/LemonStudio-hub/edge-mesh.git
cd edge-mesh

# 2. Install all dependencies
pnpm install

# 3. Build the Rust/WASM crypto module
pnpm wasm:build

# 4. Start the worker (terminal 1)
pnpm worker:dev

# 5. Start the frontend (terminal 2)
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Open a second tab or a different browser to test P2P connections.

## Development Workflow

### Daily Development

The typical development loop:

1. **Start the worker** — `pnpm worker:dev` (runs on port 8787)
2. **Start the frontend** — `pnpm dev` (runs on port 5173)
3. **Make changes** — Edit files in `packages/`
4. **Test manually** — Open two browser tabs, create posts, connect, transfer files
5. **Run tests** — `pnpm -C packages/worker test`

### Hot Module Replacement

The frontend uses Vite's HMR. Changes to Vue components, TypeScript files, and CSS are reflected immediately in the browser without a full page reload.

The worker uses Wrangler's dev mode, which automatically reloads when source files change.

### Build Order

The packages have dependencies that require a specific build order:

```
shared → frontend
shared → worker
```

The `pnpm build` command handles this automatically via the `--recursive` flag. If building manually:

```bash
pnpm -C packages/shared build    # Must be first
pnpm -C packages/frontend build  # Depends on shared
pnpm -C packages/worker build    # Depends on shared
```

## Package Details

### `@edge-mesh/shared`

The shared package contains pure TypeScript types and constants with no runtime dependencies.

**Key files:**
- `src/types.ts` — All shared type definitions (Post, PeerInfo, FileMetadata, SignalMessage, FileTransferMessage)
- `src/constants.ts` — Configuration constants (ICE config, STUN servers, chunk size, timeouts)

**Building:**
```bash
pnpm -C packages/shared build
```

Uses `tsc` with composite project references. Output goes to `dist/`.

**When to modify:** When adding new message types, changing file transfer protocol constants, or modifying ICE configuration.

### `@edge-mesh/frontend`

Vue 3 SPA built with Vite.

**Key directories:**
- `src/views/` — Route-level components (HomeView, TransferView)
- `src/components/` — Reusable UI components
- `src/composables/` — Vue composables for signaling, WebRTC, file transfer, online status
- `src/stores/` — Pinia stores (peer, posts, session, transfer)
- `src/utils/` — Utility functions (API URL helper)

**Path aliases:** `@/*` maps to `src/*` (configured in `tsconfig.json` and `vite.config.ts`).

**Dev server:** Port 5173, proxies `/api` to `http://localhost:8787` with WebSocket support.

**When to modify:** When changing the UI, adding new components, modifying WebRTC logic, or adjusting the file transfer protocol implementation.

### `@edge-mesh/worker`

Cloudflare Worker with Hono router and Durable Objects.

**Key directories:**
- `src/routes/` — Hono route handlers (health, posts, signaling)
- `src/durable-objects/` — Durable Object classes (PostRegistry, SignalingRoom)
- `src/wasm/edge-mesh-crypto/` — Rust source for the WASM crypto module
- `test/` — Vitest tests

**Dev server:** Port 8787 (via Wrangler).

**When to modify:** When changing the API, modifying Durable Object behavior, or updating the Rust/WASM crypto module.

### Rust/WASM Crypto Module

Located at `packages/worker/src/wasm/edge-mesh-crypto/`.

**Source files:**
- `src/lib.rs` — Module root, re-exports public functions
- `src/peer_id.rs` — `generate_peer_id(seed)` function
- `src/checksum.rs` — `compute_checksum(data)` and `IncrementalChecksum` class

**Building:**
```bash
pnpm wasm:build
# Or directly:
cd packages/worker/src/wasm/edge-mesh-crypto
wasm-pack build --target bundler --out-dir ../../../pkg
```

**Output:** `packages/worker/pkg/` contains the compiled `.wasm` binary, JS glue code, and TypeScript declarations.

## Debugging

### Frontend Debugging

1. Open browser DevTools (F12 or Cmd+Option+I)
2. **Console** — Look for WebSocket connection messages and WebRTC events
3. **Network tab** — Monitor API requests to `/api/posts` and WebSocket frames on `/api/signal/*`
4. **Sources tab** — Vue components are available under `src/` thanks to Vite's source maps

**Useful console commands:**
```javascript
// Check the current peer store state
__VUE_DEVTOOLS_GLOBAL_STORE__?.get('peer')

// Monitor WebRTC connection state
// (set a breakpoint in useWebRTC.ts connect() or accept())
```

### Worker Debugging

The Wrangler dev server outputs logs to the terminal where you ran `pnpm worker:dev`.

**Useful log points:**
- Add `console.log()` in Durable Object methods
- Request/response logging is available via Hono middleware

### WebRTC Debugging

WebRTC connections can be tricky to debug. Use these browser tools:

1. **`chrome://webrtc-internals`** (Chrome/Edge) — Detailed WebRTC statistics
2. **`about:webrtc`** (Firefox) — WebRTC connection logs
3. **Console logging** — Add breakpoints in `useWebRTC.ts` and `useFileTransfer.ts`

**Common WebRTC issues:**
- **ICE connection fails** — Check if STUN servers are reachable; try different networks
- **DataChannel doesn't open** — Verify both peers completed offer/answer exchange
- **File transfer stalls** — Check `bufferedAmount` and flow control thresholds

### Network Simulation

To test under poor network conditions:

1. Open DevTools → Network tab
2. Set throttling to "Slow 3G" or "Fast 3G"
3. Test file transfer to verify flow control works

For WebRTC-specific testing, use `chrome://webrtc-internals` to monitor ICE candidate gathering and connection state transitions.

## Testing

### Running Tests

```bash
# Run worker tests
pnpm -C packages/worker test
```

### Test Framework

The worker uses [Vitest](https://vitest.dev/) with [@cloudflare/vitest-pool-workers](https://developers.cloudflare.com/workers/testing/vitest-integration/) for integration testing against Durable Objects.

### Writing Tests

Test files are located in `packages/worker/test/`. The test framework provides:

- `wrangler` — Access to the worker's Durable Objects in tests
- `fetch` — Simulated fetch to the worker
- `DurableObjectStub` — Direct access to Durable Object instances

Example test structure:
```typescript
import { describe, it, expect } from 'vitest';

describe('EdgeMesh Worker', () => {
  it('should return health status', async () => {
    // Test implementation
  });
});
```

## Common Tasks

### Adding a New API Endpoint

1. Create a route handler in `packages/worker/src/routes/`
2. Register it in `packages/worker/src/index.ts`
3. Add types to `packages/shared/src/types.ts` if needed
4. Add the API call to `packages/frontend/src/utils/api.ts`
5. Update `docs/api.md` with the new endpoint documentation

### Adding a New WebSocket Message Type

1. Add the message type to `SignalMessage` or `FileTransferMessage` in `packages/shared/src/types.ts`
2. Handle the message in the appropriate Durable Object (`SignalingRoom` or the frontend composable)
3. Update `docs/api.md` with the new message format

### Adding a New Vue Component

1. Create the component in `packages/frontend/src/components/`
2. Use the `<script setup lang="ts">` syntax
3. Import and use in the appropriate view or parent component
4. Follow existing component patterns for styling (CSS custom properties from `main.css`)

### Modifying the Rust/WASM Module

1. Edit source files in `packages/worker/src/wasm/edge-mesh-crypto/src/`
2. Rebuild: `pnpm wasm:build`
3. If adding new exports, update `src/lib.rs` to re-export them
4. The TypeScript declarations are auto-generated in `packages/worker/pkg/`

## IDE Setup

### VS Code (Recommended)

Install these extensions for the best development experience:

- [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) — Vue 3 language support
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) — Rust language server
- [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) — Rust debugging

**Settings** (`/.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "[rust]": {
    "editor.tabSize": 4
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "vue.server.hybridMode": true
}
```

### JetBrains (WebStorm / RustRover)

- WebStorm has built-in Vue and TypeScript support
- RustRover provides Rust and WASM support
- Use the pnpm integration for running scripts

## Troubleshooting

### `pnpm install` fails

- Ensure you're using pnpm >= 10: `pnpm --version`
- Try clearing the store: `pnpm store prune`
- Delete `node_modules` and reinstall: `rm -rf node_modules && pnpm install`

### `pnpm wasm:build` fails

- Ensure Rust is installed: `rustc --version`
- Ensure the WASM target is available: `rustup target list --installed`
- Ensure wasm-pack is installed: `wasm-pack --version`
- Try updating Rust: `rustup update`

### Worker won't start

- Ensure WASM is built first: `pnpm wasm:build`
- Check if port 8787 is already in use: `lsof -i :8787`
- Check Wrangler logs for errors

### Frontend can't connect to worker

- Ensure the worker is running on port 8787
- Check that `VITE_SIGNALING_URL` is set correctly (or use the default)
- The Vite dev server proxies `/api` to the worker — check `vite.config.ts`

### WebRTC connection fails

- Both peers must be on networks that allow WebRTC (some corporate firewalls block it)
- Check `chrome://webrtc-internals` for ICE candidate gathering status
- Try disabling VPN or using a different network
- Ensure STUN servers are reachable (check browser console for errors)

### File transfer is slow or stalls

- Check `bufferedAmount` on the DataChannel — the sender pauses at 1 MB buffered
- Ensure the network connection is stable
- Large files (>100 MB) may take time due to WebRTC's inherent bandwidth limitations
- Check the browser's task manager for memory usage with very large files
