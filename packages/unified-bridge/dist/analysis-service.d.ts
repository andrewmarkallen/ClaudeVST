/**
 * Analysis service - orchestrates Docker ML analysis + TypeScript post-processing
 */
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
export type AnalyzerType = 'allin1' | 'msaf' | 'genre-segmenter';
export declare class AnalysisService {
    private dockerAvailable;
    /**
     * Check if Docker is available
     */
    isDockerAvailable(): Promise<boolean>;
    /**
     * Check if a Docker image exists
     */
    isImageAvailable(imageName: string): Promise<boolean>;
    /**
     * Run Docker analysis container
     */
    private runDockerAnalysis;
    /**
     * Parse allin1 result and convert to unified format
     */
    private fromAllin1;
    /**
     * Parse MSAF result and convert to unified format
     */
    private fromMsaf;
    /**
     * Parse genre-segmenter result and convert to unified format
     */
    private fromGenreSegmenter;
    /**
     * Quantize timestamp to nearest N-bar boundary
     */
    private quantizeToBar;
    /**
     * Quantize all segment boundaries
     */
    private quantizeSegments;
    /**
     * Merge adjacent segments with same label
     */
    private mergeAdjacentSameLabel;
    /**
     * Detect transitions (segments < N bars)
     */
    private detectTransitions;
    /**
     * Synthesize 3 hierarchy levels
     */
    private synthesizeHierarchy;
    /**
     * Analyze an audio file with fallback support
     * Priority: genre-segmenter -> allin1 -> msaf
     */
    analyzeTrack(audioPath: string): Promise<AnalysisResult>;
}
export declare const analysisService: AnalysisService;
export {};
//# sourceMappingURL=analysis-service.d.ts.map