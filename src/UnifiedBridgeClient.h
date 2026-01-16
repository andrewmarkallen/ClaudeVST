#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <functional>

class UnifiedBridgeClient
{
public:
    using ResponseCallback = std::function<void(bool success, const juce::var& response)>;

    // Base URL for unified-bridge REST API
    static void setBaseUrl(const juce::String& url);

    // Send a command to unified-bridge
    static void sendCommand(const juce::String& command, const juce::var& args, ResponseCallback callback);

    // Convenience methods
    static void createAudioTrack(int index, ResponseCallback callback);
    static void setTrackName(int trackIndex, const juce::String& name, ResponseCallback callback);
    static void createAudioClipSession(int trackIndex, int clipIndex, const juce::String& filePath, ResponseCallback callback);
    static void setClipName(int trackIndex, int clipIndex, const juce::String& name, ResponseCallback callback);
    static void setClipColor(int trackIndex, int clipIndex, int colorIndex, ResponseCallback callback);
    static void createAudioClipArrangement(int trackIndex, const juce::String& filePath, float positionBeats, ResponseCallback callback);

private:
    static juce::String baseUrl;
};
