/**
 * Delta caching system for Ableton state.
 * Tracks state changes and returns only deltas to minimize token usage.
 * Target: 85-95% token reduction for repeated queries.
 */
import { createHash } from 'crypto';
export class DeltaCache {
    sessionCache = null;
    trackCaches = new Map();
    deviceCaches = new Map();
    /**
     * Compute MD5 hash of data for change detection
     */
    computeHash(data) {
        try {
            const jsonStr = JSON.stringify(data, Object.keys(data).sort());
            return createHash('md5').update(jsonStr).digest('hex');
        }
        catch (error) {
            console.error('Error computing hash:', error);
            return Date.now().toString();
        }
    }
    /**
     * Get delta for session info
     */
    getSessionDelta(newState) {
        const currentHash = this.computeHash(newState);
        const timestamp = Date.now();
        if (!this.sessionCache) {
            // First call - return full state
            this.sessionCache = { state: newState, hash: currentHash, timestamp };
            return {
                type: 'full',
                state: newState,
                hash: currentHash,
                timestamp,
            };
        }
        // Check if anything changed
        if (this.sessionCache.hash === currentHash) {
            return {
                type: 'no_change',
                hash: currentHash,
                timestamp: this.sessionCache.timestamp,
            };
        }
        // Compute delta
        const changes = this.computeDictDelta(this.sessionCache.state, newState);
        // Update cache
        this.sessionCache = { state: newState, hash: currentHash, timestamp };
        return {
            type: 'delta',
            changes,
            hash: currentHash,
            timestamp,
        };
    }
    /**
     * Get delta for track info
     */
    getTrackDelta(trackIndex, newState) {
        const currentHash = this.computeHash(newState);
        const timestamp = Date.now();
        const cached = this.trackCaches.get(trackIndex);
        if (!cached) {
            // First call - return full state
            this.trackCaches.set(trackIndex, { state: newState, hash: currentHash, timestamp });
            return {
                type: 'full',
                track_index: trackIndex,
                state: newState,
                hash: currentHash,
                timestamp,
            };
        }
        // Check if anything changed
        if (cached.hash === currentHash) {
            return {
                type: 'no_change',
                track_index: trackIndex,
                hash: currentHash,
                timestamp: cached.timestamp,
            };
        }
        // Compute delta
        const changes = this.computeDictDelta(cached.state, newState);
        // Update cache
        this.trackCaches.set(trackIndex, { state: newState, hash: currentHash, timestamp });
        return {
            type: 'delta',
            track_index: trackIndex,
            changes,
            hash: currentHash,
            timestamp,
        };
    }
    /**
     * Get delta for device parameters
     */
    getDeviceDelta(trackIndex, deviceIndex, newState) {
        const cacheKey = `${trackIndex}_${deviceIndex}`;
        const currentHash = this.computeHash(newState);
        const timestamp = Date.now();
        const cached = this.deviceCaches.get(cacheKey);
        if (!cached) {
            // First call - return full state
            this.deviceCaches.set(cacheKey, { state: newState, hash: currentHash, timestamp });
            return {
                type: 'full',
                track_index: trackIndex,
                device_index: deviceIndex,
                state: newState,
                hash: currentHash,
                timestamp,
            };
        }
        // Check if anything changed
        if (cached.hash === currentHash) {
            return {
                type: 'no_change',
                track_index: trackIndex,
                device_index: deviceIndex,
                hash: currentHash,
                timestamp: cached.timestamp,
            };
        }
        // Compute parameter-specific delta
        const changes = this.computeParameterDelta(cached.state, newState);
        // Update cache
        this.deviceCaches.set(cacheKey, { state: newState, hash: currentHash, timestamp });
        return {
            type: 'delta',
            track_index: trackIndex,
            device_index: deviceIndex,
            changes,
            hash: currentHash,
            timestamp,
        };
    }
    /**
     * Reset cache to force full state on next query
     */
    resetCache(scope = 'all') {
        switch (scope) {
            case 'all':
                this.sessionCache = null;
                this.trackCaches.clear();
                this.deviceCaches.clear();
                console.log('[DeltaCache] Reset all caches');
                break;
            case 'session':
                this.sessionCache = null;
                console.log('[DeltaCache] Reset session cache');
                break;
            case 'tracks':
                this.trackCaches.clear();
                console.log('[DeltaCache] Reset track caches');
                break;
            case 'devices':
                this.deviceCaches.clear();
                console.log('[DeltaCache] Reset device caches');
                break;
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            session_cached: this.sessionCache !== null,
            track_caches: this.trackCaches.size,
            device_caches: this.deviceCaches.size,
            cache_keys: {
                tracks: Array.from(this.trackCaches.keys()),
                devices: Array.from(this.deviceCaches.keys()),
            },
        };
    }
    /**
     * Compute delta between two objects
     */
    computeDictDelta(oldDict, newDict, path = '') {
        const changes = [];
        // Check for modified or new keys
        for (const [key, newValue] of Object.entries(newDict)) {
            const currentPath = path ? `${path}.${key}` : key;
            if (!(key in oldDict)) {
                // New key
                changes.push({
                    path: currentPath,
                    type: 'added',
                    value: newValue,
                });
            }
            else if (oldDict[key] !== newValue) {
                // Modified value
                if (this.isObject(newValue) && this.isObject(oldDict[key])) {
                    // Recurse for nested objects
                    const nestedChanges = this.computeDictDelta(oldDict[key], newValue, currentPath);
                    changes.push(...nestedChanges);
                }
                else if (Array.isArray(newValue) && Array.isArray(oldDict[key])) {
                    // Compare arrays
                    const listChanges = this.computeListDelta(oldDict[key], newValue, currentPath);
                    changes.push(...listChanges);
                }
                else {
                    // Simple value change
                    changes.push({
                        path: currentPath,
                        type: 'modified',
                        old_value: oldDict[key],
                        new_value: newValue,
                    });
                }
            }
        }
        // Check for removed keys
        for (const key of Object.keys(oldDict)) {
            if (!(key in newDict)) {
                const currentPath = path ? `${path}.${key}` : key;
                changes.push({
                    path: currentPath,
                    type: 'removed',
                    old_value: oldDict[key],
                });
            }
        }
        return changes;
    }
    /**
     * Compute delta between two arrays
     */
    computeListDelta(oldList, newList, path) {
        const changes = [];
        // Check if lengths differ
        if (oldList.length !== newList.length) {
            changes.push({
                path,
                type: 'length_changed',
                old_value: oldList.length,
                new_value: newList.length,
            });
        }
        // Compare elements
        const minLen = Math.min(oldList.length, newList.length);
        for (let i = 0; i < minLen; i++) {
            const currentPath = `${path}[${i}]`;
            if (oldList[i] !== newList[i]) {
                if (this.isObject(newList[i]) && this.isObject(oldList[i])) {
                    // Recurse for nested objects
                    const nestedChanges = this.computeDictDelta(oldList[i], newList[i], currentPath);
                    changes.push(...nestedChanges);
                }
                else {
                    // Simple value change
                    changes.push({
                        path: currentPath,
                        type: 'modified',
                        old_value: oldList[i],
                        new_value: newList[i],
                    });
                }
            }
        }
        // New elements added
        for (let i = oldList.length; i < newList.length; i++) {
            changes.push({
                path: `${path}[${i}]`,
                type: 'added',
                value: newList[i],
            });
        }
        // Elements removed
        for (let i = newList.length; i < oldList.length; i++) {
            changes.push({
                path: `${path}[${i}]`,
                type: 'removed',
                old_value: oldList[i],
            });
        }
        return changes;
    }
    /**
     * Specialized delta computation for device parameters
     */
    computeParameterDelta(oldState, newState) {
        const changes = [];
        const oldParams = new Map((oldState.parameters || []).map((p) => [p.index, p]));
        const newParams = new Map((newState.parameters || []).map((p) => [p.index, p]));
        // Check for modified parameters
        for (const [idx, newParam] of newParams.entries()) {
            const oldParam = oldParams.get(idx);
            if (oldParam) {
                // Check if value changed
                if (oldParam.value !== newParam.value) {
                    changes.push({
                        path: `parameters[${idx}].value`,
                        type: 'modified',
                        old_value: oldParam.value,
                        new_value: newParam.value,
                    });
                }
            }
            else {
                // Parameter added (rare)
                changes.push({
                    path: `parameters[${idx}]`,
                    type: 'added',
                    value: newParam,
                });
            }
        }
        return changes;
    }
    /**
     * Check if value is a plain object
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
}
//# sourceMappingURL=delta-cache.js.map