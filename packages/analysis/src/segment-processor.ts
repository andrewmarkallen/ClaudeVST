/**
 * Segment processing for hierarchy synthesis
 */

import {
  Segment,
  HierarchyLevel,
  AnalysisResult,
  QuantizerConfig,
  DEFAULT_CONFIG,
  Allin1Result,
  MsafResult,
  RawAnalysis,
  MSAF_FALLBACK_LABELS,
} from './types.js';
import {
  quantizeSegments,
  mergeAdjacentSameLabel,
  filterZeroLengthSegments,
  getBarDuration,
} from './bar-quantization.js';

/**
 * Detect and flag segments shorter than N bars as transitions
 *
 * @param segments - Segments to process
 * @param bpm - Beats per minute
 * @param minBars - Minimum bars to not be a transition (default 2)
 */
export function detectTransitions(
  segments: Segment[],
  bpm: number,
  minBars: number = 2
): Segment[] {
  const barDuration = getBarDuration(bpm);
  const threshold = barDuration * minBars;

  return segments.map(seg => ({
    ...seg,
    is_transition: (seg.end - seg.start) < threshold,
  }));
}

/**
 * Split segments at N-bar boundaries for finer granularity
 *
 * @param segments - Segments to split
 * @param downbeats - Downbeat times
 * @param bpm - Beats per minute
 * @param splitBars - Split at every N bars (default 2)
 */
export function splitAtBarBoundaries(
  segments: Segment[],
  downbeats: number[],
  bpm: number,
  splitBars: number = 2
): Segment[] {
  if (downbeats.length === 0) return segments;

  const result: Segment[] = [];
  const barDuration = getBarDuration(bpm);
  const splitDuration = barDuration * splitBars;

  for (const seg of segments) {
    const duration = seg.end - seg.start;

    // Don't split short segments
    if (duration <= splitDuration * 1.5) {
      result.push(seg);
      continue;
    }

    // Find downbeats within this segment
    const segDownbeats = downbeats.filter(d => d > seg.start && d < seg.end);

    // Split at every splitBars downbeats
    let splitStart = seg.start;
    for (let i = splitBars - 1; i < segDownbeats.length; i += splitBars) {
      const splitEnd = segDownbeats[i];

      result.push({
        start: splitStart,
        end: splitEnd,
        label: seg.label,
        is_transition: false,
      });

      splitStart = splitEnd;
    }

    // Add final segment
    if (splitStart < seg.end) {
      result.push({
        start: splitStart,
        end: seg.end,
        label: seg.label,
        is_transition: false,
      });
    }
  }

  return result;
}

/**
 * Convert allin1 result to unified RawAnalysis format
 */
export function fromAllin1(result: Allin1Result): RawAnalysis {
  return {
    bpm: result.bpm,
    beats: result.beats,
    downbeats: result.downbeats,
    segments: result.segments
      .filter(s => s.label !== 'start' && s.label !== 'end') // Remove pseudo-segments
      .map(s => ({
        start: s.start,
        end: s.end,
        label: s.label,
        is_transition: false,
      })),
    source: 'allin1',
  };
}

/**
 * Convert MSAF result to unified RawAnalysis format
 * Note: MSAF returns cluster IDs, not semantic labels
 */
export function fromMsaf(result: MsafResult): RawAnalysis {
  const segments: Segment[] = [];

  for (let i = 0; i < result.boundaries.length - 1; i++) {
    const clusterIdx = result.labels[i] ?? 0;
    // Use generic section labels for MSAF (cluster IDs aren't semantic)
    const label = MSAF_FALLBACK_LABELS[clusterIdx % MSAF_FALLBACK_LABELS.length];

    segments.push({
      start: result.boundaries[i],
      end: result.boundaries[i + 1],
      label,
      is_transition: false,
    });
  }

  return {
    bpm: result.bpm,
    beats: result.beats,
    downbeats: result.downbeats,
    segments,
    source: 'msaf',
  };
}

/**
 * Synthesize 3 hierarchy levels from raw analysis
 *
 * - Level 0 (coarse): Merge adjacent same-label, 8-bar quantization
 * - Level 1 (medium): Direct output, 4-bar quantization
 * - Level 2 (fine): Split at 2-bar boundaries
 */
export function synthesizeHierarchy(
  raw: RawAnalysis,
  config: QuantizerConfig = DEFAULT_CONFIG
): HierarchyLevel[] {
  const { segments, downbeats, bpm } = raw;

  // Level 1 (medium): 4-bar quantization
  const mediumConfig: QuantizerConfig = { ...config, snapBars: 4 };
  let mediumSegments = quantizeSegments(segments, downbeats, mediumConfig);
  mediumSegments = filterZeroLengthSegments(mediumSegments);
  mediumSegments = detectTransitions(mediumSegments, bpm, 2);

  // Level 0 (coarse): Merge adjacent same-label, 8-bar quantization
  const coarseConfig: QuantizerConfig = { ...config, snapBars: 8 };
  let coarseSegments = quantizeSegments(segments, downbeats, coarseConfig);
  coarseSegments = filterZeroLengthSegments(coarseSegments);
  coarseSegments = mergeAdjacentSameLabel(coarseSegments);
  coarseSegments = detectTransitions(coarseSegments, bpm, 4);

  // Level 2 (fine): Split at 2-bar boundaries
  let fineSegments = splitAtBarBoundaries(mediumSegments, downbeats, bpm, 2);
  fineSegments = detectTransitions(fineSegments, bpm, 1);

  return [
    { level: 0, segments: coarseSegments },
    { level: 1, segments: mediumSegments },
    { level: 2, segments: fineSegments },
  ];
}

/**
 * Process raw analysis into final result format for C++
 */
export function processAnalysis(raw: RawAnalysis): AnalysisResult {
  const lastSegment = raw.segments[raw.segments.length - 1];
  const duration = lastSegment?.end ?? 0;

  const levels = synthesizeHierarchy(raw);

  return {
    duration_seconds: duration,
    tempo_bpm: raw.bpm,
    levels,
  };
}
