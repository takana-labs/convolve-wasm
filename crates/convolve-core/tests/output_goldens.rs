#![cfg(not(target_arch = "wasm32"))]

mod golden_fixtures;

use convolve_core::{ProcessMetadata, process};
use sha2::{Digest, Sha256};

use golden_fixtures::{GOLDEN_MODES, assert_extensible_pcm24_header, expected, golden_inputs};

fn assert_metadata(metadata: &ProcessMetadata, expected: &golden_fixtures::ExpectedGolden) {
    assert_eq!(metadata.sample_rate, 48_000);
    assert_eq!(metadata.channels, 2);
    assert_eq!(metadata.output_frames, expected.output_frames);
    assert_eq!(metadata.detected_beats, expected.detected_beats);
    assert_eq!(
        metadata.duration_seconds.to_bits(),
        expected.duration_seconds_bits
    );
    assert_eq!(
        metadata.detected_bpm.map(f32::to_bits),
        expected.detected_bpm_bits
    );
    assert_eq!(
        metadata.beat_confidence.map(f32::to_bits),
        expected.beat_confidence_bits
    );
    assert_eq!(
        metadata.applied_gain_db.to_bits(),
        expected.applied_gain_db_bits
    );
    assert_eq!(
        metadata.estimated_true_peak_dbtp.to_bits(),
        expected.estimated_true_peak_dbtp_bits,
    );
}

#[test]
fn full_engine_wav_and_metadata_match_frozen_goldens() {
    let (a, b) = golden_inputs();
    for mode in GOLDEN_MODES {
        let result = process(&a, &b, mode.append_reverse(), mode.options()).unwrap();
        let expected = expected(mode);
        assert_extensible_pcm24_header(&result.wav_bytes);
        assert_eq!(
            format!("{:x}", Sha256::digest(&result.wav_bytes)),
            expected.wav_sha256,
            "{} WAV SHA-256 changed",
            mode.name(),
        );
        assert_metadata(&result.metadata, &expected);
    }
}
