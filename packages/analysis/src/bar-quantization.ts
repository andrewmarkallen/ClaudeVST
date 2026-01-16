/**
 * Bar quantization utilities for snapping segment boundaries to bar grid
 */

import { QuantizerConfig, DEFAULT_CONFIG, Segment } from './types.js';

/**
 * Calculate the duration of one bar in seconds
 */
export function getBarDuration(bpm: number, beatsPerBar: number = 4): number {
  return (60.0 / bpm) * beatsPerBar;
}

/**
 * Find the index of the downbeat closest to the given timestamp
 */
export function findNearestDownbeatIndex(
  t: number,
  downbeats: number[]
): number {
  if (downbeats.length === 0) return 0;

  return downbeats.reduce((iBest, downbeat, i, arr) => {
    const curr = Math.abs(downbeat - t);
    const best = Math.abs(arr[iBest] - t);
    return curr < best ? i : iBest;
  }, 0);
}

/**
 * Snap a timestamp to the nearest N-bar boundary using the downbeat grid
 *
 * @param timestamp - Time in seconds to quantize
 * @param downbeats - Array of downbeat times in seconds
 * @param config - Quantization config (snapBars determines resolution)
 * @returns Quantized timestamp in seconds
 */
export function quantizeToBar(
  timestamp: number,
  downbeats: number[],
  config: QuantizerConfig = DEFAULT_CONFIG
): number {
  if (downbeats.length === 0) return timestamp;

  // Find closest downbeat
  const closestIdx = findNearestDownbeatIndex(timestamp, downbeats);

  // Snap to N-bar boundary
  const quantizedIdx = Math.round(closestIdx / config.snapBars) * config.snapBars;
  const clampedIdx = Math.max(0, Math.min(quantizedIdx, downbeats.length - 1));

  return downbeats[clampedIdx];
}

/**
 * Quantize using calculated bar positions when no downbeat grid is available
 *
 * @param timestamp - Time in seconds to quantize
 * @param bpm - Beats per minute
 * @param config - Quantization config
 * @returns Quantized timestamp in seconds
 */
export function quantizeToBarByBpm(
  timestamp: number,
  bpm: number,
  config: QuantizerConfig = DEFAULT_CONFIG
): number {
  const barDuration = getBarDuration(bpm, config.beatsPerBar);
  const snapDuration = barDuration * config.snapBars;

  return Math.round(timestamp / snapDuration) * snapDuration;
}

/**
 * Quantize all segment boundaries to the bar grid
 *
 * @param segments - Array of segments to quantize
 * @param downbeats - Array of downbeat times
 * @param config - Quantization config
 * @returns New array with quantized segments
 */
export function quantizeSegments(
  segments: Segment[],
  downbeats: number[],
  config: QuantizerConfig = DEFAULT_CONFIG
): Segment[] {
  return segments.map(seg => ({
    ...seg,
    start: quantizeToBar(seg.start, downbeats, config),
    end: quantizeToBar(seg.end, downbeats, config),
  }));
}

/**
 * Remove zero-length segments that may result from quantization
 */
export function filterZeroLengthSegments(segments: Segment[]): Segment[] {
  return segments.filter(seg => seg.end > seg.start);
}

/**
 * Merge adjacent segments with the same label
 */
export function mergeAdjacentSameLabel(segments: Segment[]): Segment[] {
  if (segments.length === 0) return [];

  return segments.slice(1).reduce((merged, seg) => {
    const last = merged[merged.length - 1];

    if (seg.label === last.label && !seg.is_transition) {
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }

    return merged;
  }, [{ ...segments[0] }]);
}
