use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

/// Generate a peer ID from a seed string.
/// Returns a 16-character hex string derived from SHA-256.
#[wasm_bindgen]
pub fn generate_peer_id(seed: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());

    // Add random salt for uniqueness
    let mut salt = [0u8; 8];
    getrandom::getrandom(&mut salt).expect("failed to generate random salt");
    hasher.update(salt);

    let result = hasher.finalize();
    hex::encode(&result[..8])
}
