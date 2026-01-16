#include "SpeechRecognizer.h"
#include <juce_events/juce_events.h>
#include "whisper.h"

class SpeechRecognizer::Impl : public juce::Thread
{
public:
    whisper_context* ctx = nullptr;
    SpeechRecognizer& owner;

    juce::CriticalSection transcribeLock;
    std::vector<float> audioToTranscribe;
    TranscriptionCallback callback;
    std::atomic<bool> hasWork{false};

    Impl(SpeechRecognizer& o) : Thread("Whisper Thread"), owner(o)
    {
        startThread();
    }

    ~Impl()
    {
        stopThread(5000);
        if (ctx != nullptr)
        {
            whisper_free(ctx);
        }
    }

    bool loadModel(const juce::String& modelPath)
    {
        if (ctx != nullptr)
        {
            whisper_free(ctx);
            ctx = nullptr;
        }

        whisper_context_params cparams = whisper_context_default_params();
        cparams.use_gpu = true;  // Use Metal acceleration

        ctx = whisper_init_from_file_with_params(modelPath.toRawUTF8(), cparams);
        return ctx != nullptr;
    }

    void queueTranscription(const std::vector<float>& audio, TranscriptionCallback cb)
    {
        {
            juce::ScopedLock lock(transcribeLock);
            audioToTranscribe = audio;
            callback = cb;
        }
        hasWork.store(true);
        notify();
    }

    void run() override
    {
        while (!threadShouldExit())
        {
            if (hasWork.load())
            {
                hasWork.store(false);

                std::vector<float> audio;
                TranscriptionCallback cb;

                {
                    juce::ScopedLock lock(transcribeLock);
                    audio = std::move(audioToTranscribe);
                    cb = callback;
                }

                if (!audio.empty() && ctx != nullptr && cb)
                {
                    juce::String result = transcribe(audio);

                    juce::MessageManager::callAsync([cb, result]() {
                        cb(result);
                    });
                }
            }
            else
            {
                wait(100);
            }
        }
    }

    juce::String transcribe(const std::vector<float>& audio)
    {
        if (ctx == nullptr || audio.empty())
            return {};

        whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        wparams.print_realtime = false;
        wparams.print_progress = false;
        wparams.print_timestamps = false;
        wparams.print_special = false;
        wparams.single_segment = true;
        wparams.max_tokens = 256;
        wparams.language = "en";
        wparams.n_threads = 4;

        // Run whisper
        if (whisper_full(ctx, wparams, audio.data(), static_cast<int>(audio.size())) != 0)
        {
            return "Error transcribing audio";
        }

        // Get result
        juce::String result;
        int n_segments = whisper_full_n_segments(ctx);
        for (int i = 0; i < n_segments; ++i)
        {
            const char* text = whisper_full_get_segment_text(ctx, i);
            if (text != nullptr)
            {
                result += text;
            }
        }

        return result.trim();
    }
};

SpeechRecognizer::SpeechRecognizer()
    : impl(std::make_unique<Impl>(*this))
{
    recordingBuffer.reserve(MAX_RECORDING_SAMPLES);
}

SpeechRecognizer::~SpeechRecognizer() = default;

bool SpeechRecognizer::initialize(const juce::String& modelPath)
{
    bool success = impl->loadModel(modelPath);
    modelLoaded.store(success);
    return success;
}

void SpeechRecognizer::startListening(TranscriptionCallback onResult)
{
    if (!modelLoaded.load())
        return;

    {
        juce::ScopedLock lock(bufferLock);
        recordingBuffer.clear();
    }

    pendingCallback = onResult;
    listening.store(true);
}

void SpeechRecognizer::stopListening()
{
    if (!listening.load())
        return;

    listening.store(false);

    // Get recorded audio and resample to 16kHz for whisper
    std::vector<float> audioForWhisper;

    {
        juce::ScopedLock lock(bufferLock);
        if (recordingBuffer.empty())
            return;

        // Resample from currentSampleRate to 16000 Hz
        double ratio = 16000.0 / currentSampleRate;
        size_t outputSize = static_cast<size_t>(recordingBuffer.size() * ratio);
        audioForWhisper.resize(outputSize);

        for (size_t i = 0; i < outputSize; ++i)
        {
            double srcIdx = i / ratio;
            size_t idx0 = static_cast<size_t>(srcIdx);
            size_t idx1 = std::min(idx0 + 1, recordingBuffer.size() - 1);
            double frac = srcIdx - idx0;
            audioForWhisper[i] = static_cast<float>(
                recordingBuffer[idx0] * (1.0 - frac) + recordingBuffer[idx1] * frac
            );
        }
    }

    // Queue for transcription
    if (pendingCallback && !audioForWhisper.empty())
    {
        impl->queueTranscription(audioForWhisper, pendingCallback);
    }
}

void SpeechRecognizer::processAudioInput(const float* inputData, int numSamples)
{
    if (!listening.load())
        return;

    juce::ScopedLock lock(bufferLock);

    // Don't exceed max recording length
    size_t remainingCapacity = MAX_RECORDING_SAMPLES - recordingBuffer.size();
    size_t samplesToAdd = std::min(static_cast<size_t>(numSamples), remainingCapacity);

    if (samplesToAdd > 0)
    {
        recordingBuffer.insert(recordingBuffer.end(), inputData, inputData + samplesToAdd);
    }
}
