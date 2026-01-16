/**
 * Types for audio analysis and structure detection
 */

/** A segment of audio with timing and label */
export interface Segment {
  start: number;      // Start time in seconds
  end: number;        // End time in seconds
  label: string;      // Semantic label (intro, verse, chorus, etc.)
  is_transition: boolean;  // True if segment is a short transition
}

/** Raw output from allin1 analyzer */
export interface Allin1Result {
  bpm: number;
  beats: number[];
  downbeats: number[];
  segments: Array<{
    start: number;
    end: number;
    label: string;
  }>;
}

/** Raw output from MSAF analyzer (fallback) */
export interface MsafResult {
  bpm: number;
  duration: number;
  beats: number[];
  downbeats: number[];
  boundaries: number[];
  labels: number[];  // Cluster IDs, not semantic labels
}

/** Unified raw analysis input (from either analyzer) */
export interface RawAnalysis {
  bpm: number;
  beats: number[];
  downbeats: number[];
  segments: Segment[];
  source: 'allin1' | 'msaf';
}

/** A hierarchy level with its segments */
export interface HierarchyLevel {
  level: number;
  segments: Segment[];
}

/** Final analysis result matching C++ expectations */
export interface AnalysisResult {
  duration_seconds: number;
  tempo_bpm: number;
  levels: HierarchyLevel[];
}

/** Configuration for bar quantization */
export interface QuantizerConfig {
  beatsPerBar: number;  // Usually 4 for 4/4 time
  snapBars: number;     // Snap to N-bar boundaries (4 for techno)
}

/** Structure parts after grid body extraction */
export interface StructureParts {
  head: Segment[];   // Non-grid intro (vocal intro, etc.)
  body: Segment[];   // Main grid-aligned structure
  tail: Segment[];   // Non-grid outro
}

/** Default quantizer config for techno */
export const DEFAULT_CONFIG: QuantizerConfig = {
  beatsPerBar: 4,
  snapBars: 4,
};

/** Semantic labels from allin1 */
export const ALLIN1_LABELS = [
  'start', 'end', 'intro', 'outro', 'break',
  'bridge', 'inst', 'solo', 'verse', 'chorus'
] as const;

/** Fallback label pool for MSAF cluster mapping */
export const MSAF_FALLBACK_LABELS = [
  'section_a', 'section_b', 'section_c', 'section_d',
  'section_e', 'section_f', 'section_g', 'section_h'
] as const;
