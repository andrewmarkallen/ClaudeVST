# Genre Segmenter Algorithm

Custom beat-synchronous segmentation algorithm for techno and psytrance music.

## Overview

The genre-segmenter is a 4-stage pipeline that transforms an audio file into structural and functional labels:

```
Audio File → Beat Tracking → Feature Extraction → Boundary Detection → Labeling
```

**Design Philosophy:**
- Pure signal processing (no deep learning)
- Genre-specific thresholds tuned for electronic music
- Bar-aligned output for DAW integration
- Combined structural (A/B/C) and functional (intro/groove/break) labels

## Pipeline Stages

### Stage 1: Beat Tracking

**File:** `segmenter/beats.py`

**Input:** Audio signal (mono, 22050 Hz)
**Output:** Tempo (BPM), beat times, downbeat times

#### Algorithm

1. **Initial beat detection** using librosa's beat tracker with `start_bpm=140`

2. **Octave error correction:**
   - If tempo < 110 BPM: double it (half-time detection)
   - If tempo > 190 BPM: halve it (double-time detection)
   - This keeps tempo in the valid 110-190 BPM range for electronic music

3. **Downbeat (bar start) detection via phase alignment:**
   ```
   For each phase in [0, 1, 2, 3]:
       strength[phase] = mean(onset_envelope at beats[phase::4])

   best_phase = argmax(strength)
   downbeats = beats[best_phase::4]
   ```

   This exploits the fact that kick drums (strong onsets) typically fall on beat 1 of each bar.

### Stage 2: Feature Extraction

**File:** `segmenter/features.py`

**Input:** Audio signal, beat times
**Output:** Feature matrix of shape (num_beats, 9)

For each beat window (time between consecutive beats), extract:

| Index | Feature | Description |
|-------|---------|-------------|
| 0 | RMS (dB) | Energy level |
| 1 | RMS Delta | Change from previous beat (attack detection) |
| 2 | Spectral Flux | Half-wave rectified magnitude change |
| 3 | Spectral Centroid | Brightness |
| 4 | Sub Ratio | Energy ratio 20-60 Hz (kick presence) |
| 5 | Bass Ratio | Energy ratio 60-250 Hz |
| 6 | Mid Ratio | Energy ratio 250-4000 Hz |
| 7 | High Ratio | Energy ratio 4000-16000 Hz |
| 8 | Onset Density | Onsets per second |

**Band Energy Ratio Calculation:**
```python
def band_energy_ratio(segment, sr, low_hz, high_hz):
    filtered = bandpass_filter(segment, low_hz, high_hz)
    return energy(filtered) / energy(segment)
```

### Stage 3: Boundary Detection

**File:** `segmenter/boundaries.py`

**Input:** Beat features, downbeat indices
**Output:** Boundary indices (beat positions where sections change)

#### Self-Similarity Matrix (SSM)

Build an N×N matrix where entry (i,j) is the cosine similarity between beat i and beat j features:

```
SSM[i,j] = cosine_similarity(features[i], features[j])
```

Segments appear as bright squares along the diagonal (self-similar regions).

#### Checkerboard Kernel Novelty

Detect boundaries by convolving a checkerboard kernel along the SSM diagonal:

```
Kernel (16×16):          Novelty at position i:
┌────────┬────────┐
│ +1 +1  │ -1 -1  │      novelty[i] = sum(SSM[i-8:i+8, i-8:i+8] * kernel)
│ +1 +1  │ -1 -1  │
├────────┼────────┤      High novelty = boundary between different sections
│ -1 -1  │ +1 +1  │
│ -1 -1  │ +1 +1  │
└────────┴────────┘
```

The kernel size of 16 beats = 4 bars ensures boundaries align with musical phrases.

#### Peak Picking

1. Find local maxima in novelty curve
2. Enforce minimum distance of 16 beats (4 bars) between peaks
3. Filter peaks below 0.1 threshold

#### Downbeat Quantization

Snap each boundary to the nearest downbeat:
```python
for boundary in boundaries:
    nearest_downbeat = argmin(|downbeats - boundary|)
    quantized.append(downbeats[nearest_downbeat])
```

### Stage 4a: Structural Labeling

**File:** `segmenter/structural.py`

**Input:** Beat features, boundaries
**Output:** Labels like "A", "B", "A'", "A+fill"

#### Segment Feature Aggregation

For each segment, compute:
- Mean of all beat features (character)
- Std of all beat features (variation)
- Concatenate into segment-level feature vector

#### Agglomerative Clustering

```python
clustering = AgglomerativeClustering(
    distance_threshold=0.5,
    metric='cosine',
    linkage='average'
)
cluster_ids = clustering.fit_predict(segment_features)
```

Map cluster IDs to letters (A, B, C...) in order of first appearance.

#### Variation Detection

For repeated sections (same letter), detect variations:

1. **Global variation (A'):** If similarity to first occurrence < 0.85
2. **Fill detection (A+fill):** If boundary region (last 2 bars) differs significantly OR has flux spike

### Stage 4b: Functional Labeling

**File:** `segmenter/functional.py`

**Input:** Beat features, boundaries, beat times, duration
**Output:** Labels like "intro", "groove", "break", "drop", "outro"

#### Classification Rules

Applied in order (first match wins):

| Condition | Label |
|-----------|-------|
| Duration < 8 seconds | `transition` |
| First segment AND energy < 40th percentile | `intro` |
| Near start (< 15% duration) AND low energy | `intro` |
| Last segment AND energy < 50th percentile | `outro` |
| Near end (> 85% duration) AND low energy | `outro` |
| Low sub ratio (< 0.4) AND low energy | `break` |
| High sub ratio (> 0.4) AND high energy (> 70th pctl) | `drop` |
| Otherwise | `groove` |

#### Genre Presets

```python
GENRE_PRESETS = {
    'techno': {
        'sub_threshold': 0.4,
        'drop_energy_percentile': 70,
        'break_energy_percentile': 40,
    },
    'psytrance': {
        'sub_threshold': 0.3,  # Less sub emphasis
        'drop_energy_percentile': 75,
        'break_energy_percentile': 35,
    }
}
```

## Output Format

```json
{
  "bpm": 129.2,
  "duration": 248.65,
  "beats": [0.0, 0.46, 0.93, ...],
  "downbeats": [0.0, 1.87, 3.75, ...],
  "boundaries": [0.0, 30.0, 62.5, 95.0, ...],
  "structural_labels": ["A", "A+fill", "B", "A'", ...],
  "functional_labels": ["intro", "groove", "break", "drop", ...]
}
```

## Configuration

All thresholds are in `segmenter/config.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TEMPO_MIN` | 110 | Minimum valid BPM |
| `TEMPO_MAX` | 190 | Maximum valid BPM |
| `CHECKERBOARD_SIZE` | 16 | Kernel size in beats (4 bars) |
| `MIN_SEGMENT_BARS` | 4 | Minimum segment length |
| `CLUSTER_DISTANCE_THRESHOLD` | 0.5 | Segment clustering threshold |
| `VARIATION_THRESHOLD` | 0.85 | Below this, mark as A' |
| `FILL_THRESHOLD` | 0.3 | Boundary divergence for +fill |

## Usage

```bash
# Docker
docker run --rm -v /path/to/audio:/audio genre-segmenter /audio/track.mp3 [genre]

# Via unified-bridge CLI
cd packages/unified-bridge && npm run analyze -- /path/to/track.mp3
```

## Tuning

**Too few boundaries:** Decrease `CHECKERBOARD_SIZE` or `CLUSTER_DISTANCE_THRESHOLD`

**Too many boundaries:** Increase `MIN_SEGMENT_BARS` or peak threshold in `_pick_peaks()`

**Wrong functional labels:** Adjust `GENRE_PRESETS` thresholds for your subgenre

## References

- Foote, J. (2000). "Automatic audio segmentation using a measure of audio novelty"
- Serra, J. et al. (2014). "Unsupervised music structure annotation by time series structure features and segment similarity"
- librosa: https://librosa.org/doc/latest/index.html
