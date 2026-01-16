"""Beat and downbeat detection."""

import numpy as np
import librosa
from .config import TEMPO_MIN, TEMPO_MAX, START_BPM


def detect_beats(audio: np.ndarray, sr: int) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Detect beats and downbeats (bar starts).

    Args:
        audio: Audio signal (mono)
        sr: Sample rate

    Returns:
        tempo: Detected BPM
        beat_times: Array of beat timestamps in seconds
        downbeat_times: Array of downbeat (bar start) timestamps
    """
    # Beat tracking with genre-appropriate tempo range
    tempo, beat_frames = librosa.beat.beat_track(
        y=audio,
        sr=sr,
        start_bpm=START_BPM,
        units='frames'
    )

    # Clamp tempo to valid range (handle octave errors)
    if tempo < TEMPO_MIN:
        tempo *= 2
        # Double the beat density
        beat_frames = _interpolate_beats(beat_frames)
    elif tempo > TEMPO_MAX:
        tempo /= 2
        # Halve the beat density
        beat_frames = beat_frames[::2]

    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Detect downbeats (every 4th beat, phase-aligned)
    downbeat_times = _detect_downbeats(audio, sr, beat_times, tempo)

    return float(tempo), beat_times, downbeat_times


def _interpolate_beats(beat_frames: np.ndarray) -> np.ndarray:
    """Double beat density by interpolating between beats."""
    if len(beat_frames) < 2:
        return beat_frames

    interpolated = []
    for i in range(len(beat_frames) - 1):
        interpolated.append(beat_frames[i])
        mid = (beat_frames[i] + beat_frames[i + 1]) // 2
        interpolated.append(mid)
    interpolated.append(beat_frames[-1])

    return np.array(interpolated)


def _detect_downbeats(
    audio: np.ndarray,
    sr: int,
    beat_times: np.ndarray,
    tempo: float
) -> np.ndarray:
    """
    Detect downbeats (beat 1 of each bar) using onset strength.

    Uses autocorrelation of onset envelope to find 4-beat periodicity,
    then determines phase offset.
    """
    # Compute onset strength
    onset_env = librosa.onset.onset_strength(y=audio, sr=sr)

    # Sample onset strength at beat positions
    beat_frames = librosa.time_to_frames(beat_times, sr=sr)
    beat_frames = np.clip(beat_frames, 0, len(onset_env) - 1)
    beat_onsets = onset_env[beat_frames]

    # Find phase with strongest onsets (0, 1, 2, or 3)
    if len(beat_onsets) < 8:
        # Not enough beats, assume first beat is downbeat
        return beat_times[::4]

    phase_strengths = []
    for phase in range(4):
        strength = beat_onsets[phase::4].mean()
        phase_strengths.append(strength)

    best_phase = np.argmax(phase_strengths)

    # Extract downbeats at detected phase
    downbeat_times = beat_times[best_phase::4]

    return downbeat_times
