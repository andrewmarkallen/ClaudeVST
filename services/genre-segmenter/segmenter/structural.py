"""Structural labeling (A/B/C) and variation detection (A'/A+fill)."""

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity
from .config import (
    CLUSTER_DISTANCE_THRESHOLD,
    VARIATION_THRESHOLD,
    FILL_THRESHOLD,
    FILL_REGION_BARS,
    FLUX_IDX
)


def assign_structural_labels(
    beat_features: np.ndarray,
    boundaries: np.ndarray
) -> list[str]:
    """
    Assign repetition labels (A, B, C...) based on segment similarity.

    Args:
        beat_features: Array of shape (num_beats, num_features)
        boundaries: Beat indices of segment boundaries

    Returns:
        labels: List of letter labels for each segment
    """
    # Compute segment-level features
    segment_features = _compute_segment_features(beat_features, boundaries)

    if len(segment_features) < 2:
        return ['A'] * len(segment_features)

    # Cluster segments
    try:
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=CLUSTER_DISTANCE_THRESHOLD,
            metric='cosine',
            linkage='average'
        )
        cluster_ids = clustering.fit_predict(segment_features)
    except Exception:
        # Fallback: each segment is unique
        cluster_ids = list(range(len(segment_features)))

    # Convert cluster IDs to letter labels (ordered by first appearance)
    label_map = {}
    labels = []
    current_letter = 0

    for cid in cluster_ids:
        if cid not in label_map:
            label_map[cid] = chr(ord('A') + current_letter)
            current_letter += 1
        labels.append(label_map[cid])

    return labels


def detect_variations(
    beat_features: np.ndarray,
    boundaries: np.ndarray,
    structural_labels: list[str]
) -> list[str]:
    """
    Refine labels with variation markers (A' for global, A+fill for boundary).

    Args:
        beat_features: Array of shape (num_beats, num_features)
        boundaries: Beat indices of segment boundaries
        structural_labels: Base structural labels ['A', 'B', 'A', ...]

    Returns:
        refined_labels: Labels with variation markers ['A', 'B', "A'", 'A+fill', ...]
    """
    refined = []
    segment_features = _compute_segment_features(beat_features, boundaries)

    # Track first occurrence of each label
    first_occurrence = {}

    for i, label in enumerate(structural_labels):
        base_label = label[0]  # Strip any existing markers

        if base_label not in first_occurrence:
            first_occurrence[base_label] = i
            refined.append(label)
            continue

        ref_idx = first_occurrence[base_label]

        # Compare to reference segment
        current_feat = segment_features[i]
        ref_feat = segment_features[ref_idx]

        similarity = cosine_similarity([current_feat], [ref_feat])[0, 0]

        # Check for fill in boundary region (last N bars)
        start, end = boundaries[i], boundaries[i + 1]
        fill_region_beats = FILL_REGION_BARS * 4

        ref_start, ref_end = boundaries[ref_idx], boundaries[ref_idx + 1]

        has_fill = _detect_boundary_fill(
            beat_features,
            start, end,
            ref_start, ref_end,
            fill_region_beats
        )

        if has_fill:
            refined.append(f"{base_label}+fill")
        elif similarity < VARIATION_THRESHOLD:
            refined.append(f"{base_label}'")
        else:
            refined.append(label)

    return refined


def _compute_segment_features(
    beat_features: np.ndarray,
    boundaries: np.ndarray
) -> np.ndarray:
    """Aggregate beat features into segment-level features."""
    segments = []

    for i in range(len(boundaries) - 1):
        start, end = boundaries[i], boundaries[i + 1]
        seg_beats = beat_features[start:end]

        if len(seg_beats) == 0:
            segments.append(np.zeros(beat_features.shape[1] * 2))
            continue

        # Mean and std capture character and variation
        mean_feat = seg_beats.mean(axis=0)
        std_feat = seg_beats.std(axis=0)

        segments.append(np.concatenate([mean_feat, std_feat]))

    return np.array(segments)


def _detect_boundary_fill(
    beat_features: np.ndarray,
    start: int, end: int,
    ref_start: int, ref_end: int,
    fill_region_beats: int
) -> bool:
    """Detect if segment has a fill/transition near its end boundary."""
    # Get boundary regions
    boundary_start = max(start, end - fill_region_beats)
    ref_boundary_start = max(ref_start, ref_end - fill_region_beats)

    current_boundary = beat_features[boundary_start:end]
    ref_boundary = beat_features[ref_boundary_start:ref_end]

    if len(current_boundary) == 0 or len(ref_boundary) == 0:
        return False

    # Compare boundary regions
    current_mean = current_boundary.mean(axis=0)
    ref_mean = ref_boundary.mean(axis=0)

    boundary_diff = np.linalg.norm(current_mean - ref_mean)

    # Check for flux spike (transient activity)
    current_flux = current_boundary[:, FLUX_IDX]
    body_flux = beat_features[start:boundary_start][:, FLUX_IDX] if boundary_start > start else current_flux

    if len(body_flux) > 0:
        flux_spike = current_flux.max() > body_flux.mean() * 2
    else:
        flux_spike = False

    return boundary_diff > FILL_THRESHOLD or flux_spike
