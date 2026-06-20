use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

/// Compute SHA-256 checksum of byte data.
/// Returns a 64-character hex string.
#[wasm_bindgen]
pub fn compute_checksum(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Compute incremental SHA-256 checksum.
/// Feed chunks one at a time, then call finalize_checksum().
#[wasm_bindgen]
pub struct IncrementalChecksum {
    hasher: Sha256,
}

#[wasm_bindgen]
impl IncrementalChecksum {
    #[wasm_bindgen(constructor)]
    pub fn new() -> IncrementalChecksum {
        IncrementalChecksum {
            hasher: Sha256::new(),
        }
    }

    /// Feed a chunk of data into the checksum
    pub fn update(&mut self, data: &[u8]) {
        self.hasher.update(data);
    }

    /// Finalize and return the hex-encoded checksum
    pub fn finalize(&mut self) -> String {
        // Reset hasher for reuse by creating a new one
        let result = self.hasher.finalize_reset();
        hex::encode(result)
    }
}
