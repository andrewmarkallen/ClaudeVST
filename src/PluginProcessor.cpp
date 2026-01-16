#include "PluginProcessor.h"
#include "PluginEditor.h"

ClaudeVSTAudioProcessor::ClaudeVSTAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withInput("Input", juce::AudioChannelSet::stereo(), true)
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
}

ClaudeVSTAudioProcessor::~ClaudeVSTAudioProcessor()
{
}

const juce::String ClaudeVSTAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool ClaudeVSTAudioProcessor::acceptsMidi() const
{
    return false;
}

bool ClaudeVSTAudioProcessor::producesMidi() const
{
    return false;
}

bool ClaudeVSTAudioProcessor::isMidiEffect() const
{
    return false;
}

double ClaudeVSTAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int ClaudeVSTAudioProcessor::getNumPrograms()
{
    return 1;
}

int ClaudeVSTAudioProcessor::getCurrentProgram()
{
    return 0;
}

void ClaudeVSTAudioProcessor::setCurrentProgram(int index)
{
    juce::ignoreUnused(index);
}

const juce::String ClaudeVSTAudioProcessor::getProgramName(int index)
{
    juce::ignoreUnused(index);
    return {};
}

void ClaudeVSTAudioProcessor::changeProgramName(int index, const juce::String& newName)
{
    juce::ignoreUnused(index, newName);
}

void ClaudeVSTAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    audioAnalyzer.prepare(sampleRate, samplesPerBlock);
    speechSynthesizer.prepare(sampleRate, samplesPerBlock);
    speechRecognizer.setSampleRate(sampleRate);

    // Initialize whisper model (only once)
    if (!speechRecognizer.hasPermission())
    {
        speechRecognizer.initialize(WHISPER_MODEL_PATH);
    }
}

void ClaudeVSTAudioProcessor::releaseResources()
{
}

bool ClaudeVSTAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return true;
}

void ClaudeVSTAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(midiMessages);
    juce::ScopedNoDenormals noDenormals;

    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    // Analyze input audio BEFORE clearing (non-destructive read)
    audioAnalyzer.processBlock(buffer);

    // Feed audio to speech recognizer if listening (uses left channel)
    if (speechRecognizer.isListening() && totalNumInputChannels > 0)
    {
        speechRecognizer.processAudioInput(buffer.getReadPointer(0), buffer.getNumSamples());
    }

    // Clear ALL output channels - don't pass through input audio
    // This prevents hearing yourself while monitoring is "In"
    for (auto i = 0; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Generate audio output
    int numSamples = buffer.getNumSamples();
    if (totalNumOutputChannels >= 2)
    {
        float* left = buffer.getWritePointer(0);
        float* right = buffer.getWritePointer(1);

        // Try TTS first
        int ttsWritten = speechSynthesizer.pullAudio(left, right, numSamples);

        // If no TTS, try beep
        if (ttsWritten == 0 && beepRequested.load())
        {
            int samplesLeft = beepSamplesLeft.load();
            int samplesToGenerate = std::min(samplesLeft, numSamples);

            static int beepPhase = 0;
            for (int i = 0; i < samplesToGenerate; ++i)
            {
                float t = static_cast<float>(beepPhase++) / 44100.0f;
                float sample = 0.4f * std::sin(2.0f * 3.14159f * 880.0f * t);
                left[i] = sample;
                right[i] = sample;
            }

            samplesLeft -= samplesToGenerate;
            beepSamplesLeft.store(samplesLeft);

            if (samplesLeft <= 0)
            {
                beepRequested.store(false);
                beepPhase = 0;
            }
        }
    }
}

bool ClaudeVSTAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* ClaudeVSTAudioProcessor::createEditor()
{
    return new ClaudeVSTAudioProcessorEditor(*this);
}

void ClaudeVSTAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    juce::ignoreUnused(destData);
}

void ClaudeVSTAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::ignoreUnused(data, sizeInBytes);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ClaudeVSTAudioProcessor();
}
