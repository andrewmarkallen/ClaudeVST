#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginProcessor.h"
#include "ClaudeClient.h"
#include "OSCClient.h"
#include "ReferenceTrackData.h"
#include "RadialSegmentView.h"
#include "DockerRunner.h"
#include "UnifiedBridgeClient.h"

class ClaudeVSTAudioProcessorEditor : public juce::AudioProcessorEditor,
                                       private juce::Timer
{
public:
    explicit ClaudeVSTAudioProcessorEditor(ClaudeVSTAudioProcessor&);
    ~ClaudeVSTAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void sendMessage();
    void appendToChat(const juce::String& sender, const juce::String& message);
    void onClaudeResponse(const juce::String& response);
    juce::String buildContextString();
    juce::String buildAnalysisJson();

    ClaudeVSTAudioProcessor& processorRef;

    // UI Components
    juce::TextEditor chatHistory;
    juce::TextEditor inputField;
    juce::TextButton sendButton;
    juce::TextButton voiceButton;

    // Level meters display
    juce::Label levelLabel;

    // Network clients
    ClaudeClient claudeClient;
    OSCClient oscClient;

    // Colors (Ableton-inspired dark theme)
    juce::Colour bgColor{0xff1e1e1e};
    juce::Colour textColor{0xffe0e0e0};
    juce::Colour accentColor{0xffff764d};  // Ableton orange
    juce::Colour inputBgColor{0xff2d2d2d};

    // Timer counter for periodic file writes
    int timerCounter = 0;

    // Reference track UI
    juce::TextButton loadReferenceButton { "Load Reference" };
    juce::TextButton clearButton { "Clear" };
    juce::TextButton applyButton { "Apply to Ableton" };
    juce::Slider detailSlider;
    juce::Label detailLabel;
    RadialSegmentView radialView;
    ReferenceTrackData referenceData;
    bool isAnalyzing = false;
    std::unique_ptr<juce::FileChooser> fileChooser;

    void loadReferenceTrack();
    void clearReferenceTrack();
    void applyToAbleton();
    void updateDetailLevel();
    void createClipsRecursive(int trackIndex, int clipIndex, const std::vector<Segment>& segments);
    void applyToSession();
    void applyToArrangement();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ClaudeVSTAudioProcessorEditor)
};
