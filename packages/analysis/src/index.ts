/**
 * @claudevst/analysis - Audio analysis orchestration and post-processing
 *
 * This package handles:
 * - Bar quantization (snapping segment boundaries to bar grid)
 * - Structure detection (identifying grid-aligned body vs non-grid head/tail)
 * - Hierarchy synthesis (creating coarse/medium/fine segmentation levels)
 *
 * The actual ML analysis is done by Python services (allin1 or MSAF).
 * This TypeScript package handles all post-processing.
 */

// Types
export type {
  Segment,
  Allin1Result,
  MsafResult,
  RawAnalysis,
  HierarchyLevel,
  AnalysisResult,
  QuantizerConfig,
  StructureParts,
} from './types.js';

export {
  DEFAULT_CONFIG,
  ALLIN1_LABELS,
  MSAF_FALLBACK_LABELS,
} from './types.js';

// Bar quantization
export {
  getBarDuration,
  findNearestDownbeatIndex,
  quantizeToBar,
  quantizeToBarByBpm,
  quantizeSegments,
  filterZeroLengthSegments,
  mergeAdjacentSameLabel,
} from './bar-quantization.js';

// Structure detection
export {
  isOnGrid,
  isDurationOnGrid,
  extractGridBody,
  detectPhraseLength,
} from './structure-detection.js';

// Segment processing
export {
  detectTransitions,
  splitAtBarBoundaries,
  fromAllin1,
  fromMsaf,
  synthesizeHierarchy,
  processAnalysis,
} from './segment-processor.js';
