"""Functional labeling (intro/groove/break/drop/outro/transition)."""

import numpy as np
from .config import (
    RMS_IDX,
    SUB_RATIO_IDX,
    ONSET_DENSITY_IDX,
    GENRE_PRESETS,
    DEFAULT_GENRE
)


def assign_functional_labels(
    beat_features: np.ndarray,
    boundaries: np.ndarray,
    beat_times: np.ndarray,
    duration_sec: float,
    genre: str = DEFAULT_GENRE
) -> list[str]:
    """
    Assign functional labels based on energy and spectral content.

    Args:
        beat_features: Array of shape (num_beats, num_features)
        boundaries: Beat indices of segment boundaries
        beat_times: Timestamps for each beat
        duration_sec: Total track duration
        genre: Genre preset to use ('techno' or 'psytrance')

    Returns:
        labels: Functional labels for each segment
    """
    preset = GENRE_PRESETS.get(genre, GENRE_PRESETS[DEFAULT_GENRE])

    # Compute segment energies for percentile calculation
    segment_energies = []
    segment_data = []

    for i in range(len(boundaries) - 1):
        start, end = boundaries[i], boundaries[i + 1]
        seg_beats = beat_features[start:end]

        if len(seg_beats) == 0:
            segment_energies.append(-60.0)
            segment_data.append({
                'energy': -60.0,
                'sub': 0.0,
                'onset_density': 0.0,
                'start_time': 0.0,
                'end_time': 0.0,
            })
            continue

        energy = seg_beats[:, RMS_IDX].mean()
        sub = seg_beats[:, SUB_RATIO_IDX].mean()
        onset_density = seg_beats[:, ONSET_DENSITY_IDX].mean()

        start_time = beat_times[min(start, len(beat_times) - 1)]
        end_time = beat_times[min(end, len(beat_times) - 1)]

        segment_energies.append(energy)
        segment_data.append({
            'energy': energy,
            'sub': sub,
            'onset_density': onset_density,
            'start_time': start_time,
            'end_time': end_time,
        })

    # Compute percentiles
    energy_array = np.array(segment_energies)

    labels = []
    num_segments = len(boundaries) - 1

    for i in range(num_segments):
        data = segment_data[i]

        # Position flags
        is_first = (i == 0)
        is_last = (i == num_segments - 1)
        near_start = data['start_time'] < duration_sec * 0.15
        near_end = data['end_time'] > duration_sec * 0.85

        # Energy percentile
        energy_percentile = _percentile_rank(data['energy'], energy_array)

        # Segment duration
        seg_duration = data['end_time'] - data['start_time']

        # Classification rules (order matters - most specific first)

        # Short segments are transitions
        if seg_duration < 8:  # ~2 bars at 120 BPM
            label = 'transition'

        # Intro: first segment or near start with low energy
        elif is_first and energy_percentile < preset['intro_max_percentile']:
            label = 'intro'
        elif near_start and energy_percentile < preset['intro_max_percentile']:
            label = 'intro'

        # Outro: last segment or near end with declining energy
        elif is_last and energy_percentile < preset['outro_max_percentile']:
            label = 'outro'
        elif near_end and energy_percentile < preset['outro_max_percentile']:
            label = 'outro'

        # Break: low energy, low sub (kick out)
        elif (data['sub'] < preset['sub_threshold'] and
              energy_percentile < preset['break_energy_percentile']):
            label = 'break'

        # Drop: high energy, strong sub (kick present)
        elif (data['sub'] > preset['sub_threshold'] and
              energy_percentile > preset['drop_energy_percentile']):
            label = 'drop'

        # Default: groove
        else:
            label = 'groove'

        labels.append(label)

    return labels


def _percentile_rank(value: float, array: np.ndarray) -> float:
    """Compute percentile rank of value within array."""
    if len(array) == 0:
        return 50.0
    return float(np.sum(array < value) / len(array) * 100)
