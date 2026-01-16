"""Genre-specific configuration and thresholds."""

# Feature indices (order in feature vector)
RMS_IDX = 0
RMS_DELTA_IDX = 1
FLUX_IDX = 2
CENTROID_IDX = 3
SUB_RATIO_IDX = 4
BASS_RATIO_IDX = 5
MID_RATIO_IDX = 6
HIGH_RATIO_IDX = 7
ONSET_DENSITY_IDX = 8

NUM_FEATURES = 9

# Beat tracking
TEMPO_MIN = 110
TEMPO_MAX = 190
START_BPM = 140

# Boundary detection
CHECKERBOARD_SIZE = 16  # beats (4 bars)
MIN_SEGMENT_BARS = 4    # Minimum segment length

# Structural labeling
CLUSTER_DISTANCE_THRESHOLD = 0.5

# Variation detection
VARIATION_THRESHOLD = 0.85  # Below this, mark as A'
FILL_THRESHOLD = 0.3        # Boundary region divergence for +fill
FILL_REGION_BARS = 2        # Look at last N bars for fill detection

# Functional labeling
GENRE_PRESETS = {
    'techno': {
        'sub_threshold': 0.4,
        'drop_energy_percentile': 70,
        'break_energy_percentile': 40,
        'intro_max_percentile': 40,
        'outro_max_percentile': 50,
    },
    'psytrance': {
        'sub_threshold': 0.3,
        'drop_energy_percentile': 75,
        'break_energy_percentile': 35,
        'intro_max_percentile': 35,
        'outro_max_percentile': 45,
    }
}

DEFAULT_GENRE = 'techno'
