/**
 * Delta caching system for Ableton state.
 * Tracks state changes and returns only deltas to minimize token usage.
 * Target: 85-95% token reduction for repeated queries.
 */
export interface DeltaResponse<T = any> {
    type: 'full' | 'delta' | 'no_change';
    hash: string;
    timestamp: number;
    state?: T;
    changes?: Change[];
    track_index?: number;
    device_index?: number;
}
export interface Change {
    path: string;
    type: 'added' | 'modified' | 'removed' | 'length_changed';
    old_value?: any;
    new_value?: any;
    value?: any;
}
export declare class DeltaCache {
    private sessionCache;
    private trackCaches;
    private deviceCaches;
    /**
     * Compute MD5 hash of data for change detection
     */
    private computeHash;
    /**
     * Get delta for session info
     */
    getSessionDelta(newState: any): DeltaResponse;
    /**
     * Get delta for track info
     */
    getTrackDelta(trackIndex: number, newState: any): DeltaResponse;
    /**
     * Get delta for device parameters
     */
    getDeviceDelta(trackIndex: number, deviceIndex: number, newState: any): DeltaResponse;
    /**
     * Reset cache to force full state on next query
     */
    resetCache(scope?: 'all' | 'session' | 'tracks' | 'devices'): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        session_cached: boolean;
        track_caches: number;
        device_caches: number;
        cache_keys: {
            tracks: number[];
            devices: string[];
        };
    };
    /**
     * Compute delta between two objects
     */
    private computeDictDelta;
    /**
     * Compute delta between two arrays
     */
    private computeListDelta;
    /**
     * Specialized delta computation for device parameters
     */
    private computeParameterDelta;
    /**
     * Check if value is a plain object
     */
    private isObject;
}
//# sourceMappingURL=delta-cache.d.ts.map