#include "AudioAnalyzer.h"
#include <cmath>

AudioAnalyzer::AudioAnalyzer()
{
    spectrumBands.fill(-100.0f);
}

void AudioAnalyzer::prepare(double sampleRate, int /*samplesPerBlock*/)
{
    currentSampleRate = sampleRate;
    fftDataIndex = 0;
    fftData.fill(0.0f);
}

void AudioAnalyzer::processBlock(const juce::AudioBuffer<float>& buffer)
{
    const int numSamples = buffer.getNumSamples();
    const int numChannels = buffer.getNumChannels();

    // Calculate RMS and Peak for each channel
    if (numChannels >= 1)
    {
        float rms = 0.0f;
        float peak = 0.0f;
        const float* data = buffer.getReadPointer(0);

        for (int i = 0; i < numSamples; ++i)
        {
            float sample = std::abs(data[i]);
            rms += sample * sample;
            peak = std::max(peak, sample);
        }

        rms = std::sqrt(rms / static_cast<float>(numSamples));
        rmsLevelL.store(rms > 0.0f ? 20.0f * std::log10(rms) : -100.0f);
        peakLevelL.store(peak > 0.0f ? 20.0f * std::log10(peak) : -100.0f);
    }

    if (numChannels >= 2)
    {
        float rms = 0.0f;
        float peak = 0.0f;
        const float* data = buffer.getReadPointer(1);

        for (int i = 0; i < numSamples; ++i)
        {
            float sample = std::abs(data[i]);
            rms += sample * sample;
            peak = std::max(peak, sample);
        }

        rms = std::sqrt(rms / static_cast<float>(numSamples));
        rmsLevelR.store(rms > 0.0f ? 20.0f * std::log10(rms) : -100.0f);
        peakLevelR.store(peak > 0.0f ? 20.0f * std::log10(peak) : -100.0f);
    }
    else
    {
        rmsLevelR.store(rmsLevelL.load());
        peakLevelR.store(peakLevelL.load());
    }

    // Feed FFT buffer (mono sum)
    for (int i = 0; i < numSamples; ++i)
    {
        float monoSample = 0.0f;
        for (int ch = 0; ch < numChannels; ++ch)
            monoSample += buffer.getSample(ch, i);
        monoSample /= static_cast<float>(numChannels);

        fftData[static_cast<size_t>(fftDataIndex)] = monoSample;
        fftDataIndex++;

        if (fftDataIndex >= fftSize)
        {
            updateSpectrum(buffer);
            fftDataIndex = 0;
        }
    }
}

void AudioAnalyzer::updateSpectrum(const juce::AudioBuffer<float>& /*buffer*/)
{
    // Apply window
    window.multiplyWithWindowingTable(fftData.data(), fftSize);

    // Clear imaginary part
    for (int i = fftSize; i < fftSize * 2; ++i)
        fftData[static_cast<size_t>(i)] = 0.0f;

    // Perform FFT
    fft.performFrequencyOnlyForwardTransform(fftData.data());

    // Calculate band energies
    const float binWidth = static_cast<float>(currentSampleRate) / static_cast<float>(fftSize);

    for (size_t band = 0; band < 8; ++band)
    {
        const int startBin = std::max(1, static_cast<int>(bandEdges[band] / binWidth));
        const int endBin = std::min(fftSize / 2, static_cast<int>(bandEdges[band + 1] / binWidth));

        float energy = 0.0f;
        int binCount = 0;

        for (int bin = startBin; bin < endBin; ++bin)
        {
            energy += fftData[static_cast<size_t>(bin)] * fftData[static_cast<size_t>(bin)];
            binCount++;
        }

        if (binCount > 0)
        {
            energy = std::sqrt(energy / static_cast<float>(binCount));
            spectrumBands[band] = energy > 0.0f ? 20.0f * std::log10(energy) : -100.0f;
        }
    }
}

float AudioAnalyzer::getRMSLevel(int channel) const
{
    return channel == 0 ? rmsLevelL.load() : rmsLevelR.load();
}

float AudioAnalyzer::getPeakLevel(int channel) const
{
    return channel == 0 ? peakLevelL.load() : peakLevelR.load();
}

float AudioAnalyzer::getCrestFactor() const
{
    float avgPeak = (peakLevelL.load() + peakLevelR.load()) / 2.0f;
    float avgRms = (rmsLevelL.load() + rmsLevelR.load()) / 2.0f;
    return avgPeak - avgRms;
}

juce::String AudioAnalyzer::getSpectrumSummary() const
{
    const char* bandNames[] = {"Sub", "Bass", "Low-Mid", "Mid", "Upper-Mid", "Presence", "Brilliance", "Air"};

    juce::String summary;
    for (size_t i = 0; i < 8; ++i)
    {
        if (i > 0) summary += ", ";
        summary += bandNames[i];
        summary += "=";
        summary += juce::String(spectrumBands[i], 0);
        summary += "dB";
    }
    return summary;
}
