#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <atomic>
#include <functional>

/**
 * Unified Control Adapter for ClaudeVST
 *
 * Communicates with the TypeScript unified bridge via HTTP REST API.
 * Provides non-blocking access to Ableton state with delta caching.
 */
class UnifiedControlAdapter
{
public:
    UnifiedControlAdapter(const juce::String& baseUrl = "http://localhost:8080");
    ~UnifiedControlAdapter();

    // Connection management
    bool isConnected() const { return connected.load(); }
    void checkConnection();

    // Non-blocking state queries (uses cached state)
    juce::var getCachedSession() const;
    juce::var getCachedTrack(int trackIndex) const;
    juce::var getCachedDevice(int trackIndex, int deviceIndex) const;

    // Async delta queries with callbacks
    using ResponseCallback = std::function<void(const juce::var& result, bool success)>;

    void fetchSessionDelta(ResponseCallback callback);
    void fetchTrackDelta(int trackIndex, ResponseCallback callback);
    void fetchDeviceDelta(int trackIndex, int deviceIndex, ResponseCallback callback);

    // Control commands (async, fire-and-forget style)
    void setParameter(int trackIndex, int deviceIndex, int paramIndex, float value);
    void setTempo(float bpm);
    void startPlayback();
    void stopPlayback();
    void fireClip(int trackIndex, int clipIndex);
    void stopClip(int trackIndex, int clipIndex);

    // Cache management
    void resetCache(const juce::String& scope = "all");
    juce::var getCacheStats() const;

    // Last error for debugging
    juce::String getLastError() const { return lastError; }

private:
    juce::URL baseUrl;
    std::atomic<bool> connected{false};
    mutable juce::CriticalSection cacheLock;

    juce::var sessionCache;
    std::map<int, juce::var> trackCaches;
    std::map<std::pair<int, int>, juce::var> deviceCaches;

    juce::String lastError;

    // HTTP helpers
    void asyncGet(const juce::String& endpoint, ResponseCallback callback);
    void asyncPost(const juce::String& endpoint, const juce::var& body, ResponseCallback callback);
    juce::var syncGet(const juce::String& endpoint);
    juce::var syncPost(const juce::String& endpoint, const juce::var& body);

    // Update cache from delta response
    void applyDelta(const juce::var& delta, juce::var& target);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(UnifiedControlAdapter)
};
