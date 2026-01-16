# VST Plugin Architecture

ClaudeVST is a VST3/AU plugin built with JUCE that provides a Claude chat interface inside Ableton Live.

---

## Build Instructions

### Prerequisites
- CMake 3.22+
- Ninja (recommended) or Make
- Xcode Command Line Tools (macOS)
- Pre-built whisper.cpp libraries in `lib/`

### Build Commands

```bash
cd /Users/mk/c/ClaudeVST

# Configure (with Ninja)
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build build

# Add permissions and re-sign (REQUIRED)
./scripts/post_build.sh
```

### Post-Build Script

The `scripts/post_build.sh` script is **essential**. It:
1. Finds the most recently built plugins
2. Adds `NSSpeechRecognitionUsageDescription` to Info.plist
3. Adds `NSMicrophoneUsageDescription` to Info.plist
4. Re-signs the plugin with ad-hoc signature

Without this, Ableton may crash when loading the plugin due to missing permissions.

---

## Timestamped Naming

Ableton aggressively caches plugin information. To force loading new builds without restarting Ableton, the plugin name includes a build timestamp:

```cmake
# CMakeLists.txt
string(TIMESTAMP BUILD_TIMESTAMP "%m%d_%H%M")
set(PLUGIN_NAME "ClaudeVST_${BUILD_TIMESTAMP}")
```

This creates plugins like:
- `ClaudeVST_0116_1547.vst3`
- `ClaudeVST_0116_1634.vst3`

In Ableton: Remove the old plugin, rescan (Preferences → Plug-Ins → Rescan), and add the new timestamped version.

---

## Source File Overview

| File | Lines | Purpose |
|------|-------|---------|
| `PluginProcessor.cpp/h` | ~180 | Audio processing, hosts analyzer/TTS/recognizer |
| `PluginEditor.cpp/h` | ~270 | Chat UI, voice button, level display |
| `ClaudeClient.cpp/h` | ~140 | File-based message I/O |
| `AudioAnalyzer.cpp/h` | ~150 | FFT spectrum analysis, RMS/peak metering |
| `OSCClient.cpp/h` | ~380 | AbletonOSC communication |
| `SpeechRecognizer.cpp/h` | ~210 | Whisper.cpp integration |
| `SpeechSynthesizer.mm/h` | ~180 | macOS AVSpeechSynthesizer |

---

## Threading Model

### Audio Thread (Real-time)
The `processBlock()` method runs on the audio thread with strict real-time requirements:
- **Cannot block** - no locks, file I/O, or allocations
- Runs at sample rate (e.g., 44100 Hz)
- Processes audio buffers of ~512-2048 samples

```cpp
void ClaudeVSTAudioProcessor::processBlock(AudioBuffer<float>& buffer, MidiBuffer&)
{
    // 1. Analyze input (non-blocking FFT)
    audioAnalyzer.processBlock(buffer);

    // 2. Feed to speech recognizer if listening
    if (speechRecognizer.isListening())
        speechRecognizer.processAudioInput(buffer.getReadPointer(0), buffer.getNumSamples());

    // 3. Clear output (don't pass through input)
    for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
        buffer.clear(ch, 0, buffer.getNumSamples());

    // 4. Pull TTS/beep audio
    speechSynthesizer.pullAudio(left, right, numSamples);
}
```

### Message Thread (UI)
UI callbacks, timers, and file I/O run on the message thread:
- Can block and allocate freely
- Used for chat display, button handlers, file polling

### Thread Communication
Use atomics for audio↔UI communication:

```cpp
// UI thread sets flag
beepRequested.store(true);

// Audio thread checks flag
if (beepRequested.load()) {
    // Generate beep samples
}
```

---

## Voice Input Flow

1. **User holds [Mic] button** → `voiceButton.onStateChange` fires
2. **Recognizer starts listening** → Sets `listening = true`, clears buffer
3. **Audio thread feeds samples** → `processAudioInput()` appends to buffer
4. **User releases button** → `stopListening()` called
5. **Audio resampled to 16kHz** → Linear interpolation from DAW sample rate
6. **Whisper transcribes** → Runs on background thread
7. **Result callback** → Posts to message thread, fills input field
8. **Auto-send** → Message sent to Claude

---

## OSC Client Connection

On editor creation, the plugin attempts to connect to AbletonOSC:

```cpp
ClaudeVSTAudioProcessorEditor::ClaudeVSTAudioProcessorEditor(...)
{
    if (oscClient.connect()) {
        appendToChat("System", "Connected to AbletonOSC");
    }

    // Set up action callback
    claudeClient.setActionCallback([this](const juce::var& action) {
        oscClient.executeAction(action);
    });
}
```

---

## Action Callback Flow

When Claude responds with actions:

1. **ClaudeClient polls** `from_claude.json` at 2Hz
2. **New response detected** → Parse JSON
3. **If `actions` array present** → Call `actionCallback` for each
4. **OSCClient::executeAction()** → Parse action type, send OSC commands
5. **AbletonOSC receives** → Executes in Ableton Live

```cpp
// from_claude.json
{
  "actions": [{"action": "mute", "track": "Bass"}]
}

// OSCClient::executeAction
if (actionType == "mute") {
    int trackIndex = findTrackByName(trackName);
    muteTrack(trackIndex, true);  // Sends OSC
}
```

---

## Plugin Bus Configuration

```cpp
ClaudeVSTAudioProcessor::ClaudeVSTAudioProcessor()
    : AudioProcessor(BusesProperties()
        .withInput("Input", AudioChannelSet::stereo(), true)
        .withOutput("Output", AudioChannelSet::stereo(), true))
```

- **Input:** Stereo, used for audio analysis and voice capture
- **Output:** Stereo, used for TTS audio and notification beeps
- **Pass-through:** Disabled (output is cleared, only TTS/beeps output)

---

## Installation Paths

After build, plugins are copied to:

| Format | Path |
|--------|------|
| VST3 | `~/Library/Audio/Plug-Ins/VST3/ClaudeVST_MMDD_HHMM.vst3` |
| AU | `~/Library/Audio/Plug-Ins/Components/ClaudeVST_MMDD_HHMM.component` |

---

## Dependencies

### JUCE Modules
- `juce_audio_utils` - Audio plugin hosting
- `juce_dsp` - FFT for spectrum analysis
- `juce_osc` - OSC communication

### Whisper.cpp Libraries (pre-built)
```
lib/
├── libwhisper.dylib
├── libggml.dylib
├── libggml-base.dylib
├── libggml-cpu.dylib
├── libggml-metal.dylib
└── libggml-blas.dylib
```

### macOS Frameworks
- AVFoundation - Text-to-speech
- Accelerate - DSP operations
- Metal/MetalKit - GPU acceleration for Whisper

---

## Debugging

### Crash Logs
```bash
ls -lt ~/Library/Logs/DiagnosticReports/ | head -5
grep "termination\|exception" ~/Library/Logs/DiagnosticReports/Live-*.ips
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Crash on load | Missing plist permissions | Run `post_build.sh` |
| "Plugin not found" | Ableton cache | Rescan or use new timestamp |
| No voice input | Mic permission denied | Grant in System Preferences |
| OSC not connecting | AbletonOSC not enabled | Enable in Ableton preferences |

### Clean Build
```bash
rm -rf build
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh
```

---

## See Also

- [WHISPER.md](WHISPER.md) - Voice recognition details
- [TTS.md](TTS.md) - Text-to-speech implementation
- [MESSAGES.md](MESSAGES.md) - File communication format
- [SYSTEM.md](SYSTEM.md) - Overall architecture
