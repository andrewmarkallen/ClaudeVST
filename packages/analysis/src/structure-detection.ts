/**
 * Structure detection for identifying grid-aligned body vs non-grid head/tail
 */

import { Segment, StructureParts, QuantizerConfig, DEFAULT_CONFIG } from './types.js';
import { findNearestDownbeatIndex, getBarDuration } from './bar-quantization.js';

/**
 * Check if a timestamp is on the bar grid (within tolerance)
 *
 * @param timestamp - Time in seconds to check
 * @param downbeats - Array of downbeat times
 * @param toleranceRatio - Tolerance as ratio of bar duration (default 0.1 = 10%)
 */
export function isOnGrid(
  timestamp: number,
  downbeats: number[],
  toleranceRatio: number = 0.1
): boolean {
  if (downbeats.length === 0) return false;

  const nearestIdx = findNearestDownbeatIndex(timestamp, downbeats);
  const nearestDownbeat = downbeats[nearestIdx];
  const distance = Math.abs(timestamp - nearestDownbeat);

  // Estimate bar duration from adjacent downbeats
  let barDuration: number;
  if (downbeats.length > 1) {
    barDuration = downbeats[1] - downbeats[0];
  } else {
    barDuration = 2.0; // Default if only one downbeat
  }

  const tolerance = barDuration * toleranceRatio;
  return distance <= tolerance;
}

/**
 * Check if a segment's duration is a multiple of N bars
 *
 * @param segment - Segment to check
 * @param bpm - Beats per minute
 * @param barMultiple - Expected bar multiple (4 for 4-bar phrases)
 * @param toleranceRatio - Tolerance as ratio (default 0.1 = 10%)
 */
export function isDurationOnGrid(
  segment: Segment,
  bpm: number,
  barMultiple: number = 4,
  toleranceRatio: number = 0.1
): boolean {
  const duration = segment.end - segment.start;
  const barDuration = getBarDuration(bpm);
  const expectedDuration = barDuration * barMultiple;

  const remainder = duration % expectedDuration;
  const tolerance = expectedDuration * toleranceRatio;

  return remainder <= tolerance || (expectedDuration - remainder) <= tolerance;
}

/**
 * Extract the grid-aligned body from segments, separating non-grid head and tail
 *
 * The "body" is the main section that fits the typical 4/4 grid structure.
 * "Head" contains any non-grid-aligned intro (like a vocal intro).
 * "Tail" contains any non-grid-aligned outro.
 *
 * @param segments - Array of segments to analyze
 * @param downbeats - Array of downbeat times
 * @param config - Quantization config
 */
export function extractGridBody(
  segments: Segment[],
  downbeats: number[],
  config: QuantizerConfig = DEFAULT_CONFIG
): StructureParts {
  if (segments.length === 0) {
    return { head: [], body: [], tail: [] };
  }

  // Find first segment that starts on grid
  let bodyStartIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (isOnGrid(segments[i].start, downbeats)) {
      bodyStartIdx = i;
      break;
    }
  }

  // Find last segment that ends on grid
  let bodyEndIdx = segments.length - 1;
  for (let i = segments.length - 1; i >= bodyStartIdx; i--) {
    if (isOnGrid(segments[i].end, downbeats)) {
      bodyEndIdx = i;
      break;
    }
  }

  // If no grid-aligned segments found, treat everything as body
  if (bodyStartIdx > bodyEndIdx) {
    return {
      head: [],
      body: segments,
      tail: [],
    };
  }

  return {
    head: segments.slice(0, bodyStartIdx),
    body: segments.slice(bodyStartIdx, bodyEndIdx + 1),
    tail: segments.slice(bodyEndIdx + 1),
  };
}

/**
 * Analyze the segment structure to determine common phrase lengths
 *
 * @param segments - Segments to analyze
 * @param bpm - Beats per minute
 * @returns Most common phrase length in bars
 */
export function detectPhraseLength(segments: Segment[], bpm: number): number {
  const barDuration = getBarDuration(bpm);
  const phraseLengths: Map<number, number> = new Map();

  for (const seg of segments) {
    if (seg.is_transition) continue;

    const duration = seg.end - seg.start;
    const bars = Math.round(duration / barDuration);

    // Round to common phrase lengths (4, 8, 16, 32)
    let phraseLength: number;
    if (bars <= 6) phraseLength = 4;
    else if (bars <= 12) phraseLength = 8;
    else if (bars <= 24) phraseLength = 16;
    else phraseLength = 32;

    phraseLengths.set(phraseLength, (phraseLengths.get(phraseLength) || 0) + 1);
  }

  // Return most common phrase length
  let maxCount = 0;
  let mostCommon = 8; // Default

  for (const [length, count] of phraseLengths) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = length;
    }
  }

  return mostCommon;
}
