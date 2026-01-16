/**
 * Analysis service - orchestrates Docker ML analysis + TypeScript post-processing
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';

const execAsync = promisify(exec);

// Import from analysis package (will need to be built and linked)
// For now, inline the types and processing logic

interface Segment {
  start: number;
  end: number;
  label: string;
  is_transition: boolean;
}

interface HierarchyLevel {
  level: number;
  segments: Segment[];
}

interface AnalysisResult {
  duration_seconds: number;
  tempo_bpm: number;
  levels: HierarchyLevel[];
}

interface Allin1Result {
  bpm: number;
  beats: number[];
  downbeats: number[];
  segments: Array<{ start: number; end: number; label: string }>;
}

interface MsafResult {
  bpm: number;
  duration: number;
  beats: number[];
  downbeats: number[];
  boundaries: number[];
  labels: number[];
}

interface GenreSegmenterResult {
  bpm: number;
  duration: number;
  beats: number[];
  downbeats: number[];
  boundaries: number[];
  structural_labels: string[];
  functional_labels: string[];
}

const MSAF_FALLBACK_LABELS = [
  'section_a', 'section_b', 'section_c', 'section_d',
  'section_e', 'section_f', 'section_g', 'section_h'
];

export type AnalyzerType = 'allin1' | 'msaf' | 'genre-segmenter';

export class AnalysisService {
  private dockerAvailable: boolean | null = null;

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable;

    try {
      await execAsync('docker --version');
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }

    return this.dockerAvailable;
  }

  /**
   * Check if a Docker image exists
   */
  async isImageAvailable(imageName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker images ${imageName} -q`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Run Docker analysis container
   */
  private async runDockerAnalysis(
    audioPath: string,
    analyzer: AnalyzerType
  ): Promise<string> {
    const imageNames: Record<AnalyzerType, string> = {
      'genre-segmenter': 'genre-segmenter',
      'allin1': 'allin1-analyzer',
      'msaf': 'msaf-analyzer',
    };
    const imageName = imageNames[analyzer];
    const timeout = analyzer === 'allin1' ? 180000 : 60000; // 3min for allin1, 1min for others

    // Resolve to absolute path and extract directory/filename for volume mount
    const absolutePath = path.resolve(audioPath);
    const directory = path.dirname(absolutePath);
    const filename = path.basename(absolutePath);

    return new Promise((resolve, reject) => {
      const args = [
        'run', '--rm',
        '-v', `${directory}:/audio`,
        imageName,
        `/audio/${filename}`
      ];

      let stdout = '';
      let stderr = '';

      const proc = spawn('docker', args, { timeout });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Docker exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Parse allin1 result and convert to unified format
   */
  private fromAllin1(raw: Allin1Result): {
    bpm: number;
    downbeats: number[];
    segments: Segment[];
  } {
    return {
      bpm: raw.bpm,
      downbeats: raw.downbeats,
      segments: raw.segments
        .filter(s => s.label !== 'start' && s.label !== 'end')
        .map(s => ({
          start: s.start,
          end: s.end,
          label: s.label,
          is_transition: false,
        })),
    };
  }

  /**
   * Parse MSAF result and convert to unified format
   */
  private fromMsaf(raw: MsafResult): {
    bpm: number;
    downbeats: number[];
    segments: Segment[];
  } {
    const segments: Segment[] = [];

    for (let i = 0; i < raw.boundaries.length - 1; i++) {
      const clusterIdx = raw.labels[i] ?? 0;
      const label = MSAF_FALLBACK_LABELS[clusterIdx % MSAF_FALLBACK_LABELS.length];

      segments.push({
        start: raw.boundaries[i],
        end: raw.boundaries[i + 1],
        label,
        is_transition: false,
      });
    }

    return {
      bpm: raw.bpm,
      downbeats: raw.downbeats,
      segments,
    };
  }

  /**
   * Parse genre-segmenter result and convert to unified format
   */
  private fromGenreSegmenter(raw: GenreSegmenterResult): {
    bpm: number;
    downbeats: number[];
    segments: Segment[];
  } {
    const segments: Segment[] = [];

    for (let i = 0; i < raw.boundaries.length - 1; i++) {
      const structural = raw.structural_labels[i] || 'A';
      const functional = raw.functional_labels[i] || 'groove';

      // Combine labels: "A (groove)" or "B+fill (drop)"
      const label = `${structural} (${functional})`;

      segments.push({
        start: raw.boundaries[i],
        end: raw.boundaries[i + 1],
        label,
        is_transition: functional === 'transition',
      });
    }

    return {
      bpm: raw.bpm,
      downbeats: raw.downbeats,
      segments,
    };
  }

  /**
   * Quantize timestamp to nearest N-bar boundary
   */
  private quantizeToBar(
    timestamp: number,
    downbeats: number[],
    snapBars: number = 4
  ): number {
    if (downbeats.length === 0) return timestamp;

    // Find closest downbeat
    let closestIdx = 0;
    let closestDist = Math.abs(downbeats[0] - timestamp);

    for (let i = 1; i < downbeats.length; i++) {
      const dist = Math.abs(downbeats[i] - timestamp);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    // Snap to N-bar boundary
    const quantizedIdx = Math.round(closestIdx / snapBars) * snapBars;
    const clampedIdx = Math.max(0, Math.min(quantizedIdx, downbeats.length - 1));

    return downbeats[clampedIdx];
  }

  /**
   * Quantize all segment boundaries
   */
  private quantizeSegments(
    segments: Segment[],
    downbeats: number[],
    snapBars: number
  ): Segment[] {
    return segments.map(seg => ({
      ...seg,
      start: this.quantizeToBar(seg.start, downbeats, snapBars),
      end: this.quantizeToBar(seg.end, downbeats, snapBars),
    })).filter(seg => seg.end > seg.start);
  }

  /**
   * Merge adjacent segments with same label
   */
  private mergeAdjacentSameLabel(segments: Segment[]): Segment[] {
    if (segments.length === 0) return [];

    const merged: Segment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];

      if (seg.label === current.label && !seg.is_transition) {
        current.end = seg.end;
      } else {
        merged.push(current);
        current = { ...seg };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Detect transitions (segments < N bars)
   */
  private detectTransitions(segments: Segment[], bpm: number, minBars: number): Segment[] {
    const barDuration = (60.0 / bpm) * 4;
    const threshold = barDuration * minBars;

    return segments.map(seg => ({
      ...seg,
      is_transition: (seg.end - seg.start) < threshold,
    }));
  }

  /**
   * Synthesize 3 hierarchy levels
   */
  private synthesizeHierarchy(
    segments: Segment[],
    downbeats: number[],
    bpm: number
  ): HierarchyLevel[] {
    // Level 1 (medium): 4-bar quantization
    let mediumSegments = this.quantizeSegments(segments, downbeats, 4);
    mediumSegments = this.detectTransitions(mediumSegments, bpm, 2);

    // Level 0 (coarse): 8-bar quantization + merge
    let coarseSegments = this.quantizeSegments(segments, downbeats, 8);
    coarseSegments = this.mergeAdjacentSameLabel(coarseSegments);
    coarseSegments = this.detectTransitions(coarseSegments, bpm, 4);

    // Level 2 (fine): Keep medium segments, mark more transitions
    const fineSegments = this.detectTransitions([...mediumSegments], bpm, 1);

    return [
      { level: 0, segments: coarseSegments },
      { level: 1, segments: mediumSegments },
      { level: 2, segments: fineSegments },
    ];
  }

  /**
   * Analyze an audio file with fallback support
   * Priority: genre-segmenter -> allin1 -> msaf
   */
  async analyzeTrack(audioPath: string): Promise<AnalysisResult> {
    // Check Docker availability
    if (!await this.isDockerAvailable()) {
      throw new Error('Docker is not available');
    }

    // Check available analyzers
    const hasGenreSegmenter = await this.isImageAvailable('genre-segmenter');
    const hasAllin1 = await this.isImageAvailable('allin1-analyzer');
    const hasMsaf = await this.isImageAvailable('msaf-analyzer');

    let rawJson: string;
    let analyzer: AnalyzerType;

    // Priority: genre-segmenter -> allin1 -> msaf
    if (hasGenreSegmenter) {
      try {
        console.log('[AnalysisService] Running genre-segmenter analysis...');
        rawJson = await this.runDockerAnalysis(audioPath, 'genre-segmenter');
        analyzer = 'genre-segmenter';
      } catch (err) {
        console.log('[AnalysisService] genre-segmenter failed, trying fallbacks:', err);
        if (hasAllin1) {
          try {
            rawJson = await this.runDockerAnalysis(audioPath, 'allin1');
            analyzer = 'allin1';
          } catch (err2) {
            if (!hasMsaf) throw err2;
            rawJson = await this.runDockerAnalysis(audioPath, 'msaf');
            analyzer = 'msaf';
          }
        } else if (hasMsaf) {
          rawJson = await this.runDockerAnalysis(audioPath, 'msaf');
          analyzer = 'msaf';
        } else {
          throw err;
        }
      }
    } else if (hasAllin1) {
      try {
        console.log('[AnalysisService] Running allin1 analysis...');
        rawJson = await this.runDockerAnalysis(audioPath, 'allin1');
        analyzer = 'allin1';
      } catch (err) {
        console.log('[AnalysisService] allin1 failed, falling back to MSAF:', err);
        if (!hasMsaf) throw err;
        rawJson = await this.runDockerAnalysis(audioPath, 'msaf');
        analyzer = 'msaf';
      }
    } else if (hasMsaf) {
      console.log('[AnalysisService] Using MSAF (genre-segmenter and allin1 not available)');
      rawJson = await this.runDockerAnalysis(audioPath, 'msaf');
      analyzer = 'msaf';
    } else {
      throw new Error('No analysis Docker images available. Build genre-segmenter, allin1-analyzer, or msaf-analyzer.');
    }

    // Parse raw result
    const raw = JSON.parse(rawJson);

    console.log('[AnalysisService] raw result keys:', Object.keys(raw));
    console.log('[AnalysisService] analyzer type:', analyzer);

    if (raw.error) {
      throw new Error(raw.error);
    }

    // Convert to unified format
    let unified: { bpm: number; downbeats: number[]; segments: Segment[] };
    if (analyzer === 'genre-segmenter') {
      unified = this.fromGenreSegmenter(raw as GenreSegmenterResult);
    } else if (analyzer === 'allin1') {
      unified = this.fromAllin1(raw as Allin1Result);
    } else {
      unified = this.fromMsaf(raw as MsafResult);
    }

    console.log('[AnalysisService] unified:', {
      hasSegments: !!unified.segments,
      segmentsLength: unified.segments?.length,
      hasDownbeats: !!unified.downbeats,
      downbeatsLength: unified.downbeats?.length,
      bpm: unified.bpm
    });

    // Get duration from last segment
    const duration = unified.segments.length > 0
      ? unified.segments[unified.segments.length - 1].end
      : 0;

    // Synthesize hierarchy
    const levels = this.synthesizeHierarchy(
      unified.segments,
      unified.downbeats,
      unified.bpm
    );

    return {
      duration_seconds: duration,
      tempo_bpm: unified.bpm,
      levels,
    };
  }
}

// Singleton instance
export const analysisService = new AnalysisService();
