"""Genre-specific music structure analyzer."""

import numpy as np
import librosa

from .config import DEFAULT_GENRE
from .beats import detect_beats
from .features import extract_beat_features
from .boundaries import detect_boundaries
from .structural import assign_structural_labels, detect_variations
from .functional import assign_functional_labels


def analyze(audio_path: str, genre: str = DEFAULT_GENRE) -> dict:
    """
    Analyze music structure with genre-specific segmentation.

    Args:
        audio_path: Path to audio file
        genre: Genre preset ('techno' or 'psytrance')

    Returns:
        dict with bpm, duration, beats, downbeats, boundaries,
        structural_labels, and functional_labels
    """
    # Load audio (mono, 22050 Hz)
    audio, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = len(audio) / sr

    # Stage 1: Beat tracking
    tempo, beat_times, downbeat_times = detect_beats(audio, sr)

    # Stage 2: Feature extraction
    beat_features = extract_beat_features(audio, sr, beat_times)

    # Convert downbeat times to beat indices
    downbeat_indices = np.array([
        np.argmin(np.abs(beat_times - dt)) for dt in downbeat_times
    ])

    # Stage 3: Boundary detection
    boundaries = detect_boundaries(beat_features, downbeat_indices)

    # Stage 4a: Structural labeling
    structural = assign_structural_labels(beat_features, boundaries)
    structural = detect_variations(beat_features, boundaries, structural)

    # Stage 4b: Functional labeling
    functional = assign_functional_labels(
        beat_features, boundaries, beat_times, duration, genre
    )

    # Convert boundaries to timestamps
    boundary_times = [float(beat_times[min(b, len(beat_times) - 1)]) for b in boundaries]

    return {
        "bpm": tempo,
        "duration": duration,
        "beats": beat_times.tolist(),
        "downbeats": downbeat_times.tolist(),
        "boundaries": boundary_times,
        "structural_labels": structural,
        "functional_labels": functional,
    }
