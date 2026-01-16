#pragma once

#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <functional>
#include <atomic>
#include <vector>

// Whisper.cpp-based speech recognition
// Records audio from VST input, transcribes with whisper - no TCC permissions needed!
class SpeechRecognizer
{
public:
    SpeechRecognizer();
    ~SpeechRecognizer();

    using TranscriptionCallback = std::function<void(const juce::String&)>;

    // Initialize whisper model (call once at startup)
    bool initialize(const juce::String& modelPath);

    // No permission needed - we use VST audio input!
    void requestPermission(std::function<void(bool)> callback) { callback(true); }
    bool hasPermission() const { return modelLoaded; }

    // Start/stop recording from VST input
    void startListening(TranscriptionCallback onResult);
    void stopListening();

    bool isListening() const { return listening.load(); }

    // Call this from processBlock to capture audio when listening
    void processAudioInput(const float* inputData, int numSamples);

    // Set sample rate (call from prepareToPlay)
    void setSampleRate(double sampleRate) { currentSampleRate = sampleRate; }

private:
    class Impl;
    std::unique_ptr<Impl> impl;

    std::atomic<bool> listening{false};
    std::atomic<bool> modelLoaded{false};
    double currentSampleRate = 44100.0;

    // Audio recording buffer
    std::vector<float> recordingBuffer;
    juce::CriticalSection bufferLock;
    static constexpr int MAX_RECORDING_SAMPLES = 16000 * 30;  // 30 seconds at 16kHz

    TranscriptionCallback pendingCallback;
};
