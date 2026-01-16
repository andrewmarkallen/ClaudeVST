#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>
#include <atomic>

// Text-to-speech synthesizer that outputs audio through the VST
// Uses macOS AVSpeechSynthesizer, captures audio to buffer for mixing
class SpeechSynthesizer
{
public:
    SpeechSynthesizer();
    ~SpeechSynthesizer();

    void prepare(double sampleRate, int samplesPerBlock);

    // Queue text to be spoken
    void speak(const juce::String& text);

    // Stop current speech
    void stop();

    // Get audio samples to mix into output (called from processBlock)
    // Returns number of samples written
    int pullAudio(float* leftChannel, float* rightChannel, int numSamples);

    bool isSpeaking() const { return speaking.load(); }

private:
    class Impl;
    std::unique_ptr<Impl> impl;

    std::atomic<bool> speaking{false};
    double currentSampleRate = 44100.0;
};
