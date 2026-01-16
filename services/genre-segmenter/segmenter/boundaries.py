"""Boundary detection via self-similarity matrix and checkerboard kernel."""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy.ndimage import maximum_filter1d
from .config import CHECKERBOARD_SIZE, MIN_SEGMENT_BARS


def detect_boundaries(
    beat_features: np.ndarray,
    downbeat_indices: np.ndarray
) -> np.ndarray:
    """
    Detect structural boundaries using SSM and checkerboard kernel.

    Args:
        beat_features: Array of shape (num_beats, num_features)
        downbeat_indices: Beat indices that are downbeats (bar starts)

    Returns:
        boundaries: Beat indices where structural boundaries occur
    """
    if len(beat_features) < CHECKERBOARD_SIZE * 2:
        # Too short, return start and end only
        return np.array([0, len(beat_features)])

    # Build self-similarity matrix
    ssm = _build_ssm(beat_features)

    # Compute novelty curve via checkerboard kernel
    novelty = _checkerboard_novelty(ssm, kernel_size=CHECKERBOARD_SIZE)

    # Peak picking
    min_distance = MIN_SEGMENT_BARS * 4  # Convert bars to beats
    peaks = _pick_peaks(novelty, min_distance=min_distance)

    # Add start and end
    boundaries = np.concatenate([[0], peaks, [len(beat_features)]])
    boundaries = np.unique(boundaries)

    # Quantize to nearest downbeat
    boundaries = _quantize_to_downbeats(boundaries, downbeat_indices)

    return boundaries


def _build_ssm(features: np.ndarray) -> np.ndarray:
    """Build self-similarity matrix using cosine similarity."""
    # Normalize features (zero mean, unit variance per feature)
    features_norm = features - features.mean(axis=0)
    std = features.std(axis=0)
    std[std < 1e-10] = 1.0  # Avoid division by zero
    features_norm = features_norm / std

    # Cosine similarity
    ssm = cosine_similarity(features_norm)

    return ssm


def _checkerboard_novelty(ssm: np.ndarray, kernel_size: int = 16) -> np.ndarray:
    """Compute novelty curve by convolving checkerboard kernel along SSM diagonal."""
    n = len(ssm)
    k = kernel_size // 2

    # Build checkerboard kernel
    kernel = np.ones((kernel_size, kernel_size))
    kernel[:k, k:] = -1
    kernel[k:, :k] = -1

    # Convolve along diagonal
    novelty = np.zeros(n)

    for i in range(k, n - k):
        # Extract region around diagonal
        region = ssm[i - k:i + k, i - k:i + k]
        if region.shape == kernel.shape:
            novelty[i] = np.sum(region * kernel)

    # Normalize
    novelty = novelty - novelty.min()
    max_val = novelty.max()
    if max_val > 0:
        novelty = novelty / max_val

    return novelty


def _pick_peaks(novelty: np.ndarray, min_distance: int = 16) -> np.ndarray:
    """Pick peaks in novelty curve with minimum distance constraint."""
    # Local maxima
    local_max = maximum_filter1d(novelty, size=min_distance, mode='constant')
    peaks = np.where((novelty == local_max) & (novelty > 0.1))[0]

    # Enforce minimum distance
    if len(peaks) == 0:
        return peaks

    filtered_peaks = [peaks[0]]
    for p in peaks[1:]:
        if p - filtered_peaks[-1] >= min_distance:
            filtered_peaks.append(p)

    return np.array(filtered_peaks)


def _quantize_to_downbeats(
    boundaries: np.ndarray,
    downbeat_indices: np.ndarray
) -> np.ndarray:
    """Snap boundaries to nearest downbeat (bar start)."""
    if len(downbeat_indices) == 0:
        return boundaries

    quantized = []
    for b in boundaries:
        # Find nearest downbeat
        distances = np.abs(downbeat_indices - b)
        nearest_idx = np.argmin(distances)
        quantized.append(downbeat_indices[nearest_idx])

    return np.unique(np.array(quantized))
