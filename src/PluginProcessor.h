#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "AudioAnalyzer.h"
#include "SpeechSynthesizer.h"
#include "SpeechRecognizer.h"
#include "UnifiedControlAdapter.h"

class ClaudeVSTAudioProcessor : public juce::AudioProcessor
{
public:
    ClaudeVSTAudioProcessor();
    ~ClaudeVSTAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    AudioAnalyzer& getAudioAnalyzer() { return audioAnalyzer; }
    SpeechSynthesizer& getSpeechSynthesizer() { return speechSynthesizer; }
    SpeechRecognizer& getSpeechRecognizer() { return speechRecognizer; }
    UnifiedControlAdapter& getUnifiedAdapter() { return unifiedAdapter; }

    // Audio output trigger
    void triggerBeep() { beepRequested.store(true); beepSamplesLeft.store(22050); }
    std::atomic<bool> beepRequested{false};
    std::atomic<int> beepSamplesLeft{0};

    // TTS audio buffer (written by TTS thread, read by audio thread)
    void queueTTSAudio(const std::vector<float>& audio);
    std::vector<float> ttsBuffer;
    std::atomic<int> ttsReadPos{0};
    std::atomic<int> ttsWritePos{0};
    std::atomic<bool> ttsPlaying{false};
    juce::SpinLock ttsLock;

private:
    AudioAnalyzer audioAnalyzer;
    SpeechSynthesizer speechSynthesizer;
    SpeechRecognizer speechRecognizer;
    UnifiedControlAdapter unifiedAdapter;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ClaudeVSTAudioProcessor)
};
