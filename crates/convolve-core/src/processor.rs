use crate::{
    BeatPanSource, ConvolveCoreError, ProcessMetadata, ProcessOptions, SAMPLE_RATE, StereoAudio,
    apply_beat_pan, convolve_stereo, detect_beat_grid, estimate_peak_bytes,
    estimate_streaming_peak_bytes,
    true_peak::normalization_for_view,
    views::{ForwardView, GainView, PalindromeView, StereoSampleView},
    wav::{encode_pcm24_wav_view, encode_pcm24_wav_view_chunk, wav_pcm24_header},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProcessStage {
    Validate,
    Convolve,
    BeatDetect,
    BeatPan,
    AppendReverse,
    Normalize,
    Encode,
    Done,
}

#[derive(Debug)]
pub struct ProcessResult {
    pub wav_bytes: Vec<u8>,
    pub metadata: ProcessMetadata,
}

/// The normalized forward convolution plus its read-only final-output view.
/// This is deliberately the ownership boundary for the streaming WASM path.
#[derive(Debug)]
pub struct ProcessSession {
    output: StereoAudio,
    append_reverse: bool,
    crossfade_frames: usize,
    gain: f32,
    metadata: ProcessMetadata,
}

impl ProcessSession {
    pub fn metadata(&self) -> &ProcessMetadata {
        &self.metadata
    }
    pub fn wav_header(&self) -> Result<[u8; crate::WAV_HEADER_BYTES], ConvolveCoreError> {
        wav_pcm24_header(self.metadata.output_frames)
    }
    pub fn pcm24_chunk(&self, offset: usize, frames: usize) -> Result<Vec<u8>, ConvolveCoreError> {
        if self.append_reverse {
            let view = GainView::new(
                PalindromeView::new(ForwardView::new(&self.output), self.crossfade_frames),
                self.gain,
            );
            encode_pcm24_wav_view_chunk(&view, offset, frames)
        } else {
            let view = GainView::new(ForwardView::new(&self.output), self.gain);
            encode_pcm24_wav_view_chunk(&view, offset, frames)
        }
    }
    pub fn encode_wav(&self) -> Result<Vec<u8>, ConvolveCoreError> {
        if self.append_reverse {
            let view = GainView::new(
                PalindromeView::new(ForwardView::new(&self.output), self.crossfade_frames),
                self.gain,
            );
            encode_pcm24_wav_view(&view)
        } else {
            let view = GainView::new(ForwardView::new(&self.output), self.gain);
            encode_pcm24_wav_view(&view)
        }
    }
}

pub fn process(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse_output: bool,
    options: ProcessOptions,
) -> Result<ProcessResult, ConvolveCoreError> {
    process_with_progress(a, b, append_reverse_output, options, |_| {})
}

pub fn process_with_progress<F>(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse_output: bool,
    options: ProcessOptions,
    mut on_progress: F,
) -> Result<ProcessResult, ConvolveCoreError>
where
    F: FnMut(ProcessStage),
{
    // The compatibility wrapper materializes the WAV, so it retains the conservative guard.
    validate_and_estimate_legacy(a, b, append_reverse_output, options)?;
    let session = process_session_with_progress_unchecked(
        a,
        b,
        append_reverse_output,
        options,
        &mut on_progress,
    )?;
    let wav_bytes = session.encode_wav()?;
    on_progress(ProcessStage::Encode);
    let metadata = session.metadata().clone();
    on_progress(ProcessStage::Done);
    Ok(ProcessResult {
        wav_bytes,
        metadata,
    })
}

/// Build a session without allocating encoded output. The caller emits encode/done only
/// once all chunks have been accepted by its output sink.
pub fn process_session_with_progress<F>(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse_output: bool,
    options: ProcessOptions,
    mut on_progress: F,
) -> Result<ProcessSession, ConvolveCoreError>
where
    F: FnMut(ProcessStage),
{
    validate_and_estimate_streaming(a, b, append_reverse_output, options)?;
    process_session_with_progress_unchecked(a, b, append_reverse_output, options, &mut on_progress)
}

fn validate_and_estimate_legacy(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse: bool,
    options: ProcessOptions,
) -> Result<(), ConvolveCoreError> {
    options.validate()?;
    let forward = crate::convolution_frames(a.frames(), b.frames())?;
    let fade = if append_reverse {
        options
            .reverse_crossfade_samples()?
            .min(forward.saturating_sub(1))
    } else {
        0
    };
    estimate_peak_bytes(a.frames(), b.frames(), append_reverse, fade)?;
    Ok(())
}
fn validate_and_estimate_streaming(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse: bool,
    options: ProcessOptions,
) -> Result<(), ConvolveCoreError> {
    options.validate()?;
    let forward = crate::convolution_frames(a.frames(), b.frames())?;
    let fade = if append_reverse {
        options
            .reverse_crossfade_samples()?
            .min(forward.saturating_sub(1))
    } else {
        0
    };
    estimate_streaming_peak_bytes(a.frames(), b.frames(), append_reverse, fade)?;
    Ok(())
}

fn process_session_with_progress_unchecked<F>(
    a: &StereoAudio,
    b: &StereoAudio,
    append_reverse: bool,
    options: ProcessOptions,
    on_progress: &mut F,
) -> Result<ProcessSession, ConvolveCoreError>
where
    F: FnMut(ProcessStage),
{
    let pan_transition_samples = options.pan_transition_samples()?;
    let requested_crossfade_samples = options.reverse_crossfade_samples()?;
    let forward_frames = crate::convolution_frames(a.frames(), b.frames())?;
    let effective_crossfade_samples = if append_reverse {
        requested_crossfade_samples.min(forward_frames.saturating_sub(1))
    } else {
        0
    };
    on_progress(ProcessStage::Validate);
    let mut output = convolve_stereo(a, b)?;
    on_progress(ProcessStage::Convolve);
    let (detected_beats, detected_bpm, beat_confidence) = match options.beat_pan {
        Some(source) => {
            let beat_source = match source {
                BeatPanSource::A => a,
                BeatPanSource::B => b,
            };
            let grid = detect_beat_grid(beat_source)?;
            on_progress(ProcessStage::BeatDetect);
            let count = apply_beat_pan(&mut output, &grid, pan_transition_samples)?;
            on_progress(ProcessStage::BeatPan);
            (count, Some(grid.bpm), Some(grid.confidence))
        }
        None => (0, None, None),
    };
    let (normalization, gain, output_frames) = if append_reverse {
        on_progress(ProcessStage::AppendReverse);
        let view = PalindromeView::new(ForwardView::new(&output), effective_crossfade_samples);
        let (normalization, gain) = normalization_for_view(&view, options.target_dbtp)?;
        (normalization, gain, view.frames())
    } else {
        let view = ForwardView::new(&output);
        let (normalization, gain) = normalization_for_view(&view, options.target_dbtp)?;
        (normalization, gain, view.frames())
    };
    on_progress(ProcessStage::Normalize);
    Ok(ProcessSession {
        output,
        append_reverse,
        crossfade_frames: effective_crossfade_samples,
        gain,
        metadata: ProcessMetadata {
            sample_rate: SAMPLE_RATE,
            channels: 2,
            duration_seconds: output_frames as f64 / f64::from(SAMPLE_RATE),
            output_frames,
            detected_beats,
            detected_bpm,
            beat_confidence,
            applied_gain_db: normalization.applied_gain_db,
            estimated_true_peak_dbtp: normalization.estimated_true_peak_dbtp,
        },
    })
}
