# Whisper Voice Recognition

ClaudeVST uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp) for local voice-to-text transcription. This avoids macOS TCC (Transparency, Consent, and Control) permissions that can cause issues with plugins.

---

## Why Whisper.cpp?

macOS Speech Recognition requires TCC permissions that:
- Pop up permission dialogs from plugins (poor UX)
- Can cause crashes if plist entries are missing
- Require user to grant access in System Preferences

Whisper.cpp is a C/C++ implementation of OpenAI's Whisper model that:
- Runs entirely locally
- Requires no system permissions
- Uses Metal GPU acceleration on macOS
- Provides excellent transcription quality

---

## Installation

### whisper.cpp Location

```
/Users/mk/c/ClaudeVST/whisper.cpp/
├── models/
│   └── ggml-tiny.bin     # ~75MB, used by default
├── build/
│   └── bin/
│       └── main          # CLI for standalone testing
└── ... (source files)
```

### Pre-built Libraries

ClaudeVST uses pre-built shared libraries in `lib/`:

```
/Users/mk/c/ClaudeVST/lib/
├── libwhisper.dylib
├── libggml.dylib
├── libggml-base.dylib
├── libggml-cpu.dylib
├── libggml-metal.dylib   # GPU acceleration
└── libggml-blas.dylib
```

### Downloading Models

Models are downloaded from Hugging Face:

```bash
cd whisper.cpp
./models/download-ggml-model.sh tiny    # 75MB, fastest
./models/download-ggml-model.sh base    # 142MB
./models/download-ggml-model.sh small   # 466MB
./models/download-ggml-model.sh medium  # 1.5GB, most accurate
```

---

## Model Options

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `tiny` | 75MB | ~1s | Good | Default, fast responses |
| `base` | 142MB | ~2s | Better | Balance of speed/quality |
| `small` | 466MB | ~5s | Great | Higher accuracy needed |
| `medium` | 1.5GB | ~15s | Excellent | Maximum accuracy |

ClaudeVST uses `tiny` for responsive voice interaction. Change in `CMakeLists.txt`:

```cmake
set(WHISPER_MODEL_PATH "${CMAKE_SOURCE_DIR}/whisper.cpp/models/ggml-tiny.bin")
```

---

## VST Integration

### Initialization

Model loads once when plugin prepares to play:

```cpp
void ClaudeVSTAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    speechRecognizer.setSampleRate(sampleRate);

    if (!speechRecognizer.hasPermission()) {
        speechRecognizer.initialize(WHISPER_MODEL_PATH);
    }
}
```

### Recording Flow

1. **Hold [Mic] button** → Starts listening
2. **Audio thread feeds samples** → Buffered at DAW sample rate
3. **Release button** → Stops listening, triggers transcription
4. **Background thread resamples** → From 44.1/48kHz to 16kHz
5. **Whisper transcribes** → On dedicated thread
6. **Callback fires** → Result posted to UI thread

```cpp
// Start listening
speechRecognizer.startListening([this](const juce::String& text) {
    inputField.setText(text);
    sendMessage();
});

// Audio thread feeds samples
if (speechRecognizer.isListening()) {
    speechRecognizer.processAudioInput(buffer.getReadPointer(0), numSamples);
}

// Stop and transcribe
speechRecognizer.stopListening();
```

### Resampling

Whisper requires 16kHz mono audio. ClaudeVST resamples from DAW sample rate:

```cpp
// Linear interpolation resampling
double ratio = 16000.0 / currentSampleRate;
size_t outputSize = static_cast<size_t>(recordingBuffer.size() * ratio);

for (size_t i = 0; i < outputSize; ++i) {
    double srcIdx = i / ratio;
    size_t idx0 = static_cast<size_t>(srcIdx);
    size_t idx1 = std::min(idx0 + 1, recordingBuffer.size() - 1);
    double frac = srcIdx - idx0;
    audioForWhisper[i] = recordingBuffer[idx0] * (1.0 - frac) +
                          recordingBuffer[idx1] * frac;
}
```

### Threading

Whisper runs on a dedicated background thread to avoid blocking:

```cpp
class SpeechRecognizer::Impl : public juce::Thread
{
    // Background thread for transcription
    void run() override {
        while (!threadShouldExit()) {
            if (hasWork.load()) {
                juce::String result = transcribe(audio);
                juce::MessageManager::callAsync([cb, result]() {
                    cb(result);  // Post result to UI
                });
            }
            wait(100);
        }
    }
};
```

---

## Whisper Parameters

```cpp
whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
wparams.print_realtime = false;
wparams.print_progress = false;
wparams.print_timestamps = false;
wparams.print_special = false;
wparams.single_segment = true;   // Single transcription segment
wparams.max_tokens = 256;         // Token limit
wparams.language = "en";          // English
wparams.n_threads = 4;            // CPU threads
```

---

## Standalone voice_listener.py

For testing voice without the VST, use `companions/voice/voice_listener.py`:

```bash
# Install dependencies
pip install sounddevice numpy

# Run
python3 companions/voice/voice_listener.py
```

### Requirements
- `sounddevice` - Audio recording
- `numpy` - Audio processing
- whisper.cpp CLI at `whisper.cpp/build/bin/main`

### Usage
```
Voice Listener started
Writing to: /Users/mk/c/ClaudeVST/messages/to_claude.json
Whisper model: /Users/mk/c/ClaudeVST/whisper.cpp/models/ggml-tiny.bin

Press Enter to start recording...
```

Press Enter, speak for 5 seconds, and the transcription is written to `to_claude.json`.

---

## Audio Format Requirements

| Parameter | Value |
|-----------|-------|
| Sample Rate | 16000 Hz |
| Channels | Mono |
| Bit Depth | Float32 (converted to int16 for WAV) |
| Max Duration | ~30 seconds (buffer limit) |

---

## GPU Acceleration

Whisper.cpp uses Metal on macOS for GPU acceleration:

```cpp
whisper_context_params cparams = whisper_context_default_params();
cparams.use_gpu = true;  // Enable Metal
```

The `libggml-metal.dylib` library provides the Metal backend.

---

## Troubleshooting

### Model Not Loading
- Check model exists: `ls whisper.cpp/models/ggml-tiny.bin`
- Verify path in `CMakeLists.txt`
- Rebuild after changing model path

### Poor Transcription Quality
- Try a larger model (base/small)
- Ensure clear audio input
- Check input levels aren't clipping

### Slow Transcription
- `tiny` model should transcribe in ~1s
- Ensure Metal acceleration is working
- Check not running on battery power (may throttle GPU)

### No Audio Input
- Verify monitoring is set to "In" in Ableton
- Check microphone permissions in System Preferences
- Ensure correct input device selected in Ableton

---

## Source Files

- `src/SpeechRecognizer.cpp` - Whisper integration, threading
- `src/SpeechRecognizer.h` - Interface
- `lib/whisper.h` - Whisper.cpp header
- `companions/voice/voice_listener.py` - Standalone script

---

## See Also

- [VST.md](VST.md) - Plugin build and architecture
- [TTS.md](TTS.md) - Text-to-speech (output side)
- [SYSTEM.md](SYSTEM.md) - Full voice I/O flow
- [whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp) - Full documentation
