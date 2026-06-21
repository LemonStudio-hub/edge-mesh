# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active |

## Reporting a Vulnerability

We take the security of EdgeMesh seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **[INSERT SECURITY EMAIL]**

You should receive a response within 48 hours acknowledging receipt. We will work with you to understand the issue and coordinate a fix and disclosure timeline.

### What to Include

When reporting a vulnerability, please include:

1. **Description** — A clear description of the vulnerability
2. **Impact** — What an attacker could achieve by exploiting it
3. **Reproduction steps** — Step-by-step instructions to reproduce the issue
4. **Affected components** — Which part of EdgeMesh is affected (frontend, worker, signaling, etc.)
5. **Suggested fix** — If you have one (optional)

### What to Expect

- **Acknowledgment** — Within 48 hours of your report
- **Assessment** — We will evaluate the severity and impact
- **Fix timeline** — We aim to release critical fixes within 7 days
- **Disclosure** — We will coordinate with you on public disclosure timing
- **Credit** — We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Considerations

EdgeMesh is a peer-to-peer file transfer application. The following security considerations are important for contributors and users to understand.

### Data Privacy

- **No server in the data path** — File contents are transferred directly between browsers via WebRTC DataChannels. The signaling server (Cloudflare Worker) never sees file data.
- **WebRTC encryption** — All WebRTC DataChannel traffic is encrypted with DTLS/SRTP by default. This is built into the WebRTC specification and cannot be disabled.
- **Ephemeral peer IDs** — Peer IDs are generated randomly on each session and are not persistent. There is no tracking or account system.

### Signaling Security

- **CORS restrictions** — The signaling worker only accepts requests from the authorized frontend origin (`https://file.ijk.cam`).
- **No file data in signaling** — The signaling server only relays WebRTC negotiation messages (SDP offers/answers and ICE candidates). It never handles file content.
- **Room isolation** — SignalingRoom Durable Objects are keyed by room ID, isolating different peer groups.

### P2P Connection Security

- **Mutual confirmation** — Both peers must explicitly accept a connection request before WebRTC negotiation begins. This prevents silent connection attempts.
- **Connection timeout** — Connection requests auto-reject after 30 seconds, preventing stale pending requests.
- **SHA-256 integrity** — Files are checksummed on both sender and receiver sides. The checksum is transmitted out-of-band (via the DataChannel control protocol) and verified after transfer.

### Known Limitations

- **No end-to-end encryption beyond WebRTC** — While WebRTC encrypts the transport, there is no additional application-layer encryption. The browser's WebRTC implementation handles encryption.
- **Trust model** — Users must trust the peer they are connecting to. EdgeMesh does not implement a trust/reputation system.
- **Metadata visibility** — While file contents are encrypted by WebRTC, the signaling server can observe which peers are connected and when connection requests are made.
- **No content scanning** — EdgeMesh does not scan or filter files being transferred. Users are responsible for the content they share.

### For Contributors

When contributing code, please be aware of these security-sensitive areas:

- **CORS configuration** — Never weaken CORS restrictions. The worker should only accept requests from authorized origins.
- **Input validation** — Always validate data received from WebSocket messages and REST API requests.
- **WebRTC configuration** — Be cautious when modifying ICE servers or connection parameters. Incorrect configuration can leak IP addresses.
- **Durable Object state** — PostRegistry stores peer data in memory. Ensure no sensitive data is persisted unnecessarily.
- **WASM module** — The Rust/WASM crypto module handles peer ID generation and checksums. Changes to this module should be reviewed carefully for correctness.

## Security Updates

Security fixes will be released as patch versions and announced via:

- GitHub Security Advisories
- Release notes
- The project README

## Acknowledgments

We thank the following individuals for responsibly disclosing security vulnerabilities:

*None yet — be the first!*
