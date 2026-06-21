# Contributing to EdgeMesh

Thank you for your interest in contributing to EdgeMesh! This guide will help you get started with development, understand our workflow, and submit effective contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Code Style and Conventions](#code-style-and-conventions)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** >= 18
- **pnpm** >= 10 (`npm install -g pnpm`)
- **Rust** toolchain with `wasm32-unknown-unknown` target
- **wasm-pack** (`cargo install wasm-pack`)
- **Git** for version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:

```bash
git clone https://github.com/<your-username>/edge-mesh.git
cd edge-mesh
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/LemonStudio-hub/edge-mesh.git
```

## Development Setup

```bash
# Install all dependencies
pnpm install

# Build the Rust/WASM crypto module (required before running the worker)
pnpm wasm:build

# Start the signaling worker (port 8787)
pnpm worker:dev

# In another terminal, start the frontend (port 5173)
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in two browser tabs to test P2P connections.

### Running Tests

```bash
# Run worker tests
pnpm -C packages/worker test
```

### Building

```bash
# Build all packages (shared → frontend → worker)
pnpm build

# Build individual packages
pnpm -C packages/shared build
pnpm -C packages/frontend build
```

## Project Architecture

EdgeMesh is organized as a pnpm monorepo with three packages:

| Package | Purpose |
|---------|---------|
| `@edge-mesh/shared` | Pure TypeScript types and constants. No runtime dependencies. |
| `@edge-mesh/frontend` | Vue 3 + Vite SPA. Peer discovery, WebRTC negotiation, file transfer UI. |
| `@edge-mesh/worker` | Cloudflare Worker with Hono router, Durable Objects, and Rust/WASM crypto. |

For detailed architecture information, see [docs/architecture.md](docs/architecture.md).

## Code Style and Conventions

### General

- **Indentation**: 2 spaces (TypeScript, Vue, JSON), 4 spaces (Rust)
- **Line endings**: LF
- **Encoding**: UTF-8
- **Trailing whitespace**: Trimmed
- **Final newline**: Required

These rules are enforced by [`.editorconfig`](.editorconfig).

### TypeScript / Vue

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- **Path aliases**: `@/*` maps to `src/*` in the frontend
- **Naming**:
  - Files: `camelCase.ts` for utilities/composables, `PascalCase.vue` for components
  - Functions/variables: `camelCase`
  - Types/interfaces: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
- **Composables**: Prefix with `use` (e.g., `useSignaling`, `useWebRTC`)
- **Pinia stores**: Prefix with `use` and suffix with `Store` (e.g., `usePeerStore`)

### Rust

- **Edition**: 2021
- **Naming**: Follow standard Rust conventions (`snake_case` for functions, `PascalCase` for types)
- **Toolchain**: Stable channel, `wasm32-unknown-unknown` target (see `rust-toolchain.toml`)
- **WASM**: Use `wasm-bindgen` for JavaScript interop

### Git Commits

Write clear, descriptive commit messages:

```
<type>: <short summary>

<optional body explaining the "why" behind the change>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Examples:
```
feat: add file transfer progress indicator
fix: prevent double-connection when both peers click Connect
docs: update API reference with WebSocket message types
```

## Making Changes

### Branching Strategy

1. Create a feature branch from `main`:

```bash
git checkout -b feat/your-feature-name
```

2. Make your changes in small, focused commits
3. Keep your branch up to date with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

### What to Work On

Good places to start contributing:

- **Issues labeled `good first issue`** — Beginner-friendly tasks
- **Issues labeled `help wanted`** — Tasks where we need community help
- **Documentation improvements** — Better examples, clearer explanations
- **Test coverage** — The worker test suite needs integration tests
- **Performance** — Optimizing chunk sizes, flow control, or ICE candidate gathering

### Testing Your Changes

Before submitting, verify:

1. **WASM builds**: `pnpm wasm:build` completes without errors
2. **Frontend builds**: `pnpm -C packages/frontend build` succeeds
3. **Worker builds**: `pnpm -C packages/worker build` succeeds
4. **Tests pass**: `pnpm -C packages/worker test`
5. **Manual testing**: Open two browser tabs and verify P2P file transfer works end-to-end

## Submitting a Pull Request

### Before You Submit

- [ ] Your code follows the project's style conventions
- [ ] You have tested your changes locally
- [ ] You have updated documentation if needed
- [ ] Your commits are clean and well-organized
- [ ] You have rebased on the latest `main`

### PR Process

1. Push your branch to your fork:

```bash
git push origin feat/your-feature-name
```

2. Open a Pull Request against `main` on the upstream repository
3. Fill out the PR template with:
   - **What** you changed and **why**
   - **How to test** your changes
   - **Screenshots** (if UI changes)
   - **Related issues** (use `Fixes #123` to auto-close)
4. Wait for CI checks to pass
5. Address review feedback promptly

### PR Title

Use the same `<type>: <summary>` format as commit messages:

```
feat: add multi-file transfer support
fix: handle WebRTC connection timeout gracefully
```

## Reporting Issues

### Bug Reports

When reporting a bug, please include:

1. **Browser and version** (e.g., Chrome 120, Firefox 121)
2. **Operating system** (e.g., macOS 14.2, Windows 11, Ubuntu 22.04)
3. **Steps to reproduce** — Clear, numbered steps
4. **Expected behavior** — What you expected to happen
5. **Actual behavior** — What actually happened
6. **Console output** — Any errors from the browser DevTools console
7. **Network conditions** — Are both peers on the same network? Behind NAT?

### Feature Requests

For feature requests, please describe:

1. **The problem** you're trying to solve
2. **Your proposed solution** (if you have one)
3. **Alternatives** you've considered
4. **Use case** — How would this feature be used?

## Community

- **GitHub Issues** — For bug reports, feature requests, and discussions
- **Pull Requests** — For code contributions

Thank you for contributing to EdgeMesh! 🎉
