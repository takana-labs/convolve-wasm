#![cfg(target_arch = "wasm32")]

mod golden_fixtures;

use convolve_core::process_audio_wasm;
use sha2::{Digest, Sha256};
use wasm_bindgen_test::*;

use golden_fixtures::{GOLDEN_MODES, assert_extensible_pcm24_header, expected_wasm, golden_inputs};

wasm_bindgen_test_configure!(run_in_node_experimental);

#[wasm_bindgen_test]
fn generated_wasm_node_full_engine_matches_frozen_goldens() {
    let (a, b) = golden_inputs();
    for mode in GOLDEN_MODES {
        let result = process_audio_wasm(
            a.left.clone().into_boxed_slice(),
            a.right.clone().into_boxed_slice(),
            b.left.clone().into_boxed_slice(),
            b.right.clone().into_boxed_slice(),
            mode.append_reverse(),
            serde_wasm_bindgen::to_value(&mode.options()).unwrap(),
            None,
        )
        .unwrap();
        let expected = expected_wasm(mode);
        let wav = result.wav_bytes().to_vec();

        assert_extensible_pcm24_header(&wav);
        assert_eq!(
            format!("{:x}", Sha256::digest(&wav)),
            expected.wav_sha256,
            "{} generated-WASM Node WAV SHA-256 changed",
            mode.name(),
        );
        assert_eq!(result.sample_rate(), 48_000);
        assert_eq!(result.channels(), 2);
        assert_eq!(result.output_frames(), expected.output_frames);
        assert_eq!(result.detected_beats(), expected.detected_beats);
        assert_eq!(
            result.duration_seconds().to_bits(),
            expected.duration_seconds_bits
        );
        assert_eq!(
            result.detected_bpm().map(f32::to_bits),
            expected.detected_bpm_bits
        );
        assert_eq!(
            result.beat_confidence().map(f32::to_bits),
            expected.beat_confidence_bits
        );
        assert_eq!(
            result.applied_gain_db().to_bits(),
            expected.applied_gain_db_bits
        );
        assert_eq!(
            result.estimated_true_peak_dbtp().to_bits(),
            expected.estimated_true_peak_dbtp_bits,
        );
    }
}
