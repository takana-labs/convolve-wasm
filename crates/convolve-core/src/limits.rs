use std::mem::size_of;

use crate::{ConvolveCoreError, WAV_HEADER_BYTES};

pub const MAX_BYTES: usize = 268_435_456;
const FIXED_HEADROOM_BYTES: usize = 16 * 1024 * 1024;
const PCM24_CHUNK_BYTES: usize = 393_216;

pub fn convolution_frames(a_frames: usize, b_frames: usize) -> Result<usize, ConvolveCoreError> {
    if a_frames == 0 || b_frames == 0 {
        return Err(ConvolveCoreError::invalid(
            "convolution inputs must not be empty",
        ));
    }
    a_frames
        .checked_add(b_frames)
        .and_then(|sum| sum.checked_sub(1))
        .ok_or_else(overflow)
}

pub fn estimate_peak_bytes(
    a_frames: usize,
    b_frames: usize,
    append_reverse: bool,
    crossfade_frames: usize,
) -> Result<usize, ConvolveCoreError> {
    estimate_peak_bytes_with_limit(
        a_frames,
        b_frames,
        append_reverse,
        crossfade_frames,
        MAX_BYTES,
    )
}

fn estimate_peak_bytes_with_limit(
    a_frames: usize,
    b_frames: usize,
    append_reverse: bool,
    crossfade_frames: usize,
    limit: usize,
) -> Result<usize, ConvolveCoreError> {
    let forward_frames = convolution_frames(a_frames, b_frames)?;
    let fft_len = forward_frames
        .checked_next_power_of_two()
        .ok_or_else(overflow)?;
    let decoded_frames = a_frames.checked_add(b_frames).ok_or_else(overflow)?;
    let final_frames = if append_reverse {
        forward_frames
            .checked_mul(2)
            .and_then(|frames| frames.checked_sub(crossfade_frames))
            .ok_or_else(overflow)?
    } else {
        forward_frames
    };

    let decoded_bytes = bytes_for_stereo(decoded_frames)?;
    let forward_bytes = bytes_for_stereo(forward_frames)?;
    let fft_workspace_bytes = fft_len.checked_mul(24).ok_or_else(overflow)?;
    let whole_wav_bytes = final_frames
        .checked_mul(6)
        .and_then(|bytes| bytes.checked_add(WAV_HEADER_BYTES))
        .ok_or_else(overflow)?;

    let estimated = decoded_bytes
        .saturating_add(forward_bytes)
        .saturating_add(fft_workspace_bytes)
        .saturating_add(whole_wav_bytes.saturating_mul(2))
        .saturating_add(PCM24_CHUNK_BYTES.saturating_mul(2))
        .saturating_add(FIXED_HEADROOM_BYTES);
    if estimated > limit {
        return Err(ConvolveCoreError::InputTooLarge { estimated, limit });
    }
    Ok(estimated)
}

/// Peak storage used by the two-phase WASM output session. Unlike the legacy
/// one-shot path this never retains a complete encoded WAV.
pub fn estimate_streaming_peak_bytes(
    a_frames: usize,
    b_frames: usize,
    append_reverse: bool,
    crossfade_frames: usize,
) -> Result<usize, ConvolveCoreError> {
    estimate_streaming_peak_bytes_with_limit(
        a_frames,
        b_frames,
        append_reverse,
        crossfade_frames,
        MAX_BYTES,
    )
}

fn estimate_streaming_peak_bytes_with_limit(
    a_frames: usize,
    b_frames: usize,
    append_reverse: bool,
    crossfade_frames: usize,
    limit: usize,
) -> Result<usize, ConvolveCoreError> {
    let forward_frames = convolution_frames(a_frames, b_frames)?;
    let fft_len = forward_frames
        .checked_next_power_of_two()
        .ok_or_else(overflow)?;
    let decoded_frames = a_frames.checked_add(b_frames).ok_or_else(overflow)?;
    if append_reverse {
        forward_frames
            .checked_mul(2)
            .and_then(|frames| frames.checked_sub(crossfade_frames))
            .ok_or_else(overflow)?;
    }
    let estimated = bytes_for_stereo(decoded_frames)?
        .saturating_add(bytes_for_stereo(forward_frames)?)
        .saturating_add(fft_len.checked_mul(24).ok_or_else(overflow)?)
        .saturating_add(PCM24_CHUNK_BYTES.saturating_mul(2))
        .saturating_add(FIXED_HEADROOM_BYTES);
    if estimated > limit {
        return Err(ConvolveCoreError::InputTooLarge { estimated, limit });
    }
    Ok(estimated)
}

fn bytes_for_stereo(frames: usize) -> Result<usize, ConvolveCoreError> {
    frames
        .checked_mul(2)
        .and_then(|samples| samples.checked_mul(size_of::<f32>()))
        .ok_or_else(overflow)
}

fn overflow() -> ConvolveCoreError {
    ConvolveCoreError::InputTooLarge {
        estimated: usize::MAX,
        limit: MAX_BYTES,
    }
}

#[cfg(test)]
mod tests {
    use super::{estimate_peak_bytes_with_limit, estimate_streaming_peak_bytes_with_limit};
    use crate::ConvolveCoreError;

    #[test]
    fn streaming_guard_can_pass_when_the_legacy_whole_wav_guard_fails_at_the_same_limit() {
        // No audio is allocated here: this asserts the routing boundary for a
        // session that may stream its PCM but cannot safely use the legacy WAV copy path.
        const LIMIT: usize = 200_000_000;
        assert_eq!(
            estimate_streaming_peak_bytes_with_limit(2_000_000, 2_000_000, true, 240, LIMIT)
                .unwrap(),
            182_226_936
        );
        assert!(matches!(
            estimate_peak_bytes_with_limit(2_000_000, 2_000_000, false, 0, LIMIT),
            Err(ConvolveCoreError::InputTooLarge { limit: LIMIT, .. })
        ));
    }
}
