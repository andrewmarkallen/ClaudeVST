#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <functional>

class DockerRunner
{
public:
    using CompletionCallback = std::function<void(bool success, const juce::String& output)>;

    static void runMsafAnalysis(const juce::String& audioFilePath, CompletionCallback callback);

private:
    static bool isDockerAvailable();
};
