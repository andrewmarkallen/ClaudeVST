#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <functional>
#include <atomic>

// File-based communication with Claude Code
// Messages go through ClaudeVST/messages/ directory
class ClaudeClient : private juce::Timer
{
public:
    ClaudeClient();
    ~ClaudeClient() override;

    using ResponseCallback = std::function<void(const juce::String&)>;
    using ActionCallback = std::function<void(const juce::var&)>;

    void sendMessage(const juce::String& userMessage,
                     const juce::String& audioContext,
                     ResponseCallback callback);

    void setActionCallback(ActionCallback callback);

    void updateAudioAnalysis(const juce::String& analysisJson);

    bool isConnected() const { return connectionActive.load(); }

private:
    void timerCallback() override;
    void checkForResponse();
    void writeMessage(const juce::String& message, const juce::String& context);

    juce::File getConfigDir();
    juce::File getOutboxFile();        // to_claude.json
    juce::File getMasterInboxFile();   // from_claude.json (Master responses)
    juce::File getTeacherInboxFile();  // from_teacher.json (Teacher responses)
    juce::File getAnalysisFile();      // audio_analysis.json

    ResponseCallback pendingCallback;
    ActionCallback actionCallback;
    juce::int64 lastMasterResponseTime = 0;
    juce::int64 lastTeacherResponseTime = 0;
    std::atomic<bool> connectionActive{false};
    std::atomic<bool> waitingForResponse{false};
    std::atomic<bool> pendingIsMasterMessage{false};  // true if current message has M: prefix

    juce::CriticalSection callbackLock;
};
