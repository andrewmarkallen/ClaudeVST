#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>
#include <array>
#include <atomic>

class AudioAnalyzer
{
public:
    AudioAnalyzer();

    void prepare(double sampleRate, int samplesPerBlock);
    void processBlock(const juce::AudioBuffer<float>& buffer);

    // Level getters (thread-safe, returns dB)
    float getRMSLevel(int channel) const;
    float getPeakLevel(int channel) const;
    float getCrestFactor() const;

    // Spectrum analysis
    juce::String getSpectrumSummary() const;
    const std::array<float, 8>& getSpectrumBands() const { return spectrumBands; }

private:
    void updateSpectrum(const juce::AudioBuffer<float>& buffer);

    double currentSampleRate = 44100.0;

    // Level tracking
    std::atomic<float> rmsLevelL{0.0f};
    std::atomic<float> rmsLevelR{0.0f};
    std::atomic<float> peakLevelL{0.0f};
    std::atomic<float> peakLevelR{0.0f};

    // FFT for spectrum analysis
    static constexpr int fftOrder = 11;  // 2048 samples
    static constexpr int fftSize = 1 << fftOrder;
    juce::dsp::FFT fft{fftOrder};
    juce::dsp::WindowingFunction<float> window{fftSize, juce::dsp::WindowingFunction<float>::hann};

    std::array<float, fftSize * 2> fftData{};
    int fftDataIndex = 0;

    // 8-band spectrum (sub, bass, low-mid, mid, upper-mid, presence, brilliance, air)
    std::array<float, 8> spectrumBands{};

    // Band frequency ranges (Hz)
    static constexpr std::array<float, 9> bandEdges = {20, 60, 250, 500, 2000, 4000, 6000, 12000, 20000};
};
