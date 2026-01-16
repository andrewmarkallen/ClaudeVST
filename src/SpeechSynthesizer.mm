#include "SpeechSynthesizer.h"
#include <juce_events/juce_events.h>

#if JUCE_MAC
#import <AVFoundation/AVFoundation.h>

// Simple atomic-based TTS implementation
// 1. TTS thread generates ALL audio for an utterance into a buffer
// 2. Sets atomic flag when ready
// 3. Audio thread reads from buffer using atomic position
class SpeechSynthesizer::Impl : public juce::Thread
{
public:
    AVSpeechSynthesizer* synthesizer = nil;
    double targetSampleRate = 44100.0;
    std::atomic<bool>& speakingRef;

    // Text queue
    juce::CriticalSection textQueueLock;
    juce::StringArray textQueue;

    // Audio buffer (written by TTS thread, read by audio thread)
    static constexpr size_t MAX_TTS_SAMPLES = 44100 * 30;  // 30 seconds max
    std::vector<float> audioBuffer;
    std::atomic<int> audioLength{0};   // Total samples in buffer
    std::atomic<int> readPosition{0};  // Current read position
    std::atomic<bool> audioReady{false};  // Flag: buffer has audio to play

    Impl(std::atomic<bool>& speaking) : Thread("TTS Thread"), speakingRef(speaking)
    {
        audioBuffer.resize(MAX_TTS_SAMPLES, 0.0f);
        synthesizer = [[AVSpeechSynthesizer alloc] init];
        startThread();
    }

    ~Impl()
    {
        stopThread(2000);
        [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    }

    void queueText(const juce::String& text)
    {
        // DEBUG: Trigger immediate beep to verify speak() is called
        debugBeepSamples.store(static_cast<int>(targetSampleRate * 0.5));  // 0.5 sec beep
        DBG("TTS queueText called: " << text);

        {
            juce::ScopedLock lock(textQueueLock);
            textQueue.add(text);
        }
        notify();  // Wake up TTS thread
    }

    void run() override
    {
        while (!threadShouldExit())
        {
            juce::String textToSpeak;
            {
                juce::ScopedLock lock(textQueueLock);
                if (textQueue.size() > 0)
                {
                    textToSpeak = textQueue[0];
                    textQueue.remove(0);
                }
            }

            if (textToSpeak.isNotEmpty())
            {
                generateTTSAudio(textToSpeak);
            }
            else
            {
                wait(100);
            }
        }
    }

    void generateTTSAudio(const juce::String& text)
    {
        speakingRef.store(true);
        DBG("TTS Thread: generateTTSAudio called for: " << text);

        // Temporary buffer to accumulate TTS output
        std::vector<float> tempBuffer;
        tempBuffer.reserve(MAX_TTS_SAMPLES);

        // DEBUG: Generate a 1-second beep to test TTS thread + buffer copy
        // This bypasses AVSpeechSynthesizer to isolate the issue
        int beepSamples = static_cast<int>(targetSampleRate * 1.0);  // 1 sec beep
        for (int i = 0; i < beepSamples; ++i)
        {
            float t = static_cast<float>(i) / static_cast<float>(targetSampleRate);
            // Different frequency (770Hz) to distinguish from queueText beep (550Hz)
            tempBuffer.push_back(0.4f * std::sin(2.0f * 3.14159f * 770.0f * t));
        }
        DBG("TTS Thread: Generated " << beepSamples << " samples of test beep");

        // Re-enable AVSpeechSynthesizer - beep plays first, then TTS should follow
        @autoreleasepool {
            AVSpeechUtterance* utterance = [[AVSpeechUtterance alloc]
                initWithString:[NSString stringWithUTF8String:text.toRawUTF8()]];

            utterance.rate = AVSpeechUtteranceDefaultSpeechRate;
            utterance.pitchMultiplier = 1.0f;
            utterance.volume = 1.0f;

            // Try premium voices
            AVSpeechSynthesisVoice* voice = nil;
            NSArray* preferredVoices = @[
                @"com.apple.voice.premium.en-US.Zoe",
                @"com.apple.ttsbundle.siri_Nicky_en-US_compact",
                @"com.apple.voice.premium.en-US.Samantha",
                @"com.apple.voice.enhanced.en-US.Samantha"
            ];

            for (NSString* voiceId in preferredVoices)
            {
                voice = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
                if (voice != nil)
                    break;
            }

            if (voice == nil)
                voice = [AVSpeechSynthesisVoice voiceWithLanguage:@"en-US"];

            utterance.voice = voice;

            // Collect all audio chunks
            __block bool done = false;
            __block std::vector<float>* bufferPtr = &tempBuffer;
            __block double targetRate = targetSampleRate;
            __block int totalFramesReceived = 0;

            [synthesizer writeUtterance:utterance
                toBufferCallback:^(AVAudioBuffer* buffer) {
                    if (buffer == nil)
                    {
                        done = true;
                        return;
                    }

                    AVAudioPCMBuffer* pcmBuffer = (AVAudioPCMBuffer*)buffer;
                    if (pcmBuffer.floatChannelData == nil)
                        return;

                    AVAudioFormat* format = pcmBuffer.format;
                    double sourceSampleRate = format.sampleRate;
                    uint32_t frameCount = pcmBuffer.frameLength;

                    // Sample rate conversion
                    double ratio = targetRate / sourceSampleRate;
                    int outputFrames = (int)(frameCount * ratio);

                    float* sourceData = pcmBuffer.floatChannelData[0];

                    // Linear interpolation resampling
                    for (int i = 0; i < outputFrames; ++i)
                    {
                        double srcIdx = i / ratio;
                        int idx0 = (int)srcIdx;
                        int idx1 = std::min(idx0 + 1, (int)frameCount - 1);
                        double frac = srcIdx - idx0;
                        float sample = static_cast<float>(
                            sourceData[idx0] * (1.0 - frac) + sourceData[idx1] * frac
                        );
                        bufferPtr->push_back(sample);
                    }
                    totalFramesReceived += outputFrames;
                }];

            // Wait for TTS to complete
            while (!done && !threadShouldExit())
            {
                juce::Thread::sleep(10);
            }

            DBG("TTS: AVSpeechSynthesizer done, generated " << totalFramesReceived << " frames");
        }

        // Copy to main buffer and signal audio thread
        if (!tempBuffer.empty() && tempBuffer.size() <= MAX_TTS_SAMPLES)
        {
            // Copy audio data
            std::copy(tempBuffer.begin(), tempBuffer.end(), audioBuffer.begin());

            // Reset read position and set length
            readPosition.store(0);
            audioLength.store(static_cast<int>(tempBuffer.size()));

            // Signal audio thread that data is ready
            audioReady.store(true);

            DBG("TTS audio ready: " << tempBuffer.size() << " samples");
        }

        speakingRef.store(false);
    }

    // DEBUG: beep triggered by queueText
    std::atomic<bool> debugBeepActive{false};
    std::atomic<int> debugBeepSamples{0};
    int debugBeepPhase = 0;

    int pullAudio(float* left, float* right, int numSamples)
    {
        // DEBUG: Play beep when triggered by queueText
        int beepRemaining = debugBeepSamples.load();
        if (beepRemaining > 0)
        {
            int toGenerate = std::min(beepRemaining, numSamples);
            for (int i = 0; i < toGenerate; ++i)
            {
                float t = static_cast<float>(debugBeepPhase++) / static_cast<float>(targetSampleRate);
                float sample = 0.4f * std::sin(2.0f * 3.14159f * 550.0f * t);
                left[i] = sample;
                right[i] = sample;
            }
            debugBeepSamples.store(beepRemaining - toGenerate);
            if (beepRemaining - toGenerate <= 0)
                debugBeepPhase = 0;
            return toGenerate;
        }

        if (!audioReady.load())
            return 0;

        int pos = readPosition.load();
        int len = audioLength.load();

        if (pos >= len)
        {
            // Done playing
            audioReady.store(false);
            return 0;
        }

        int samplesToRead = std::min(numSamples, len - pos);

        for (int i = 0; i < samplesToRead; ++i)
        {
            float sample = audioBuffer[static_cast<size_t>(pos + i)];
            left[i] = sample;
            right[i] = sample;
        }

        readPosition.store(pos + samplesToRead);
        return samplesToRead;
    }

    void stopSpeaking()
    {
        [synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        audioReady.store(false);
        audioLength.store(0);
        readPosition.store(0);
    }
};

#else
// Stub for non-Mac
class SpeechSynthesizer::Impl
{
public:
    std::atomic<bool>& speakingRef;
    Impl(std::atomic<bool>& speaking) : speakingRef(speaking) {}
    void queueText(const juce::String&) {}
    int pullAudio(float*, float*, int) { return 0; }
    void stopSpeaking() {}
    double targetSampleRate = 44100.0;
};
#endif

SpeechSynthesizer::SpeechSynthesizer() : impl(std::make_unique<Impl>(speaking)) {}
SpeechSynthesizer::~SpeechSynthesizer() = default;

void SpeechSynthesizer::prepare(double sampleRate, int /*samplesPerBlock*/)
{
    currentSampleRate = sampleRate;
    impl->targetSampleRate = sampleRate;
}

void SpeechSynthesizer::speak(const juce::String& text)
{
    impl->queueText(text);
}

void SpeechSynthesizer::stop()
{
    impl->stopSpeaking();
}

int SpeechSynthesizer::pullAudio(float* leftChannel, float* rightChannel, int numSamples)
{
    return impl->pullAudio(leftChannel, rightChannel, numSamples);
}
