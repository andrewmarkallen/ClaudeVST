"""Beat-synchronous feature extraction."""

import numpy as np
import librosa
from scipy.signal import butter, sosfilt
from .config import NUM_FEATURES


def extract_beat_features(
    audio: np.ndarray,
    sr: int,
    beat_times: np.ndarray
) -> np.ndarray:
    """
    Extract features for each beat window.

    Args:
        audio: Audio signal (mono)
        sr: Sample rate
        beat_times: Array of beat timestamps

    Returns:
        features: Array of shape (num_beats-1, NUM_FEATURES)
    """
    features = []
    prev_spectrum = None

    for i in range(len(beat_times) - 1):
        start_sample = int(beat_times[i] * sr)
        end_sample = int(beat_times[i + 1] * sr)

        # Ensure valid range
        start_sample = max(0, start_sample)
        end_sample = min(len(audio), end_sample)

        if end_sample <= start_sample:
            # Invalid segment, use zeros
            features.append(np.zeros(NUM_FEATURES))
            continue

        segment = audio[start_sample:end_sample]

        # Energy features
        rms = np.sqrt(np.mean(segment ** 2))
        rms_db = 20 * np.log10(rms + 1e-10)

        # RMS delta (attack detection)
        if len(features) > 0:
            prev_rms = features[-1][0]
            rms_delta = rms_db - prev_rms
        else:
            rms_delta = 0.0

        # Spectral flux
        spectrum = np.abs(librosa.stft(segment, n_fft=2048, hop_length=512))
        if prev_spectrum is not None and prev_spectrum.shape == spectrum.shape:
            flux = _spectral_flux(prev_spectrum, spectrum)
        else:
            flux = 0.0
        prev_spectrum = spectrum

        # Spectral centroid
        centroid = librosa.feature.spectral_centroid(y=segment, sr=sr).mean()

        # Band energy ratios
        sub_ratio = _band_energy_ratio(segment, sr, 20, 60)
        bass_ratio = _band_energy_ratio(segment, sr, 60, 250)
        mid_ratio = _band_energy_ratio(segment, sr, 250, 4000)
        high_ratio = _band_energy_ratio(segment, sr, 4000, 16000)

        # Onset density
        onset_density = _onset_density(segment, sr)

        feat_vector = np.array([
            rms_db,
            rms_delta,
            flux,
            centroid,
            sub_ratio,
            bass_ratio,
            mid_ratio,
            high_ratio,
            onset_density
        ])

        features.append(feat_vector)

    return np.array(features)


def _spectral_flux(prev_spectrum: np.ndarray, curr_spectrum: np.ndarray) -> float:
    """Half-wave rectified spectral flux (only increases)."""
    diff = curr_spectrum - prev_spectrum
    diff = np.maximum(diff, 0)  # Half-wave rectification
    return float(np.mean(diff))


def _band_energy_ratio(segment: np.ndarray, sr: int, low_hz: int, high_hz: int) -> float:
    """Compute energy ratio of a frequency band relative to total."""
    # Bandpass filter
    nyquist = sr / 2
    low = max(low_hz / nyquist, 0.001)
    high = min(high_hz / nyquist, 0.999)

    if low >= high:
        return 0.0

    try:
        sos = butter(4, [low, high], btype='band', output='sos')
        filtered = sosfilt(sos, segment)
        band_energy = np.mean(filtered ** 2)
        total_energy = np.mean(segment ** 2) + 1e-10
        return float(band_energy / total_energy)
    except ValueError:
        return 0.0


def _onset_density(segment: np.ndarray, sr: int) -> float:
    """Count onsets per second in segment."""
    onset_frames = librosa.onset.onset_detect(y=segment, sr=sr, units='frames')
    duration = len(segment) / sr
    if duration < 0.01:
        return 0.0
    return len(onset_frames) / duration
