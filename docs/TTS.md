# Text-to-Speech Service

ClaudeVST speaks Claude's responses using macOS text-to-speech. There are two implementations:

1. **VST-embedded TTS** - Uses AVSpeechSynthesizer (work in progress)
2. **Standalone tts_watcher.py** - Uses macOS `say` command (recommended)

---

## Standalone TTS Watcher (Recommended)

The `companions/tts/tts_watcher.py` script monitors `from_claude.json` and speaks responses using the macOS `say` command.

### Running

```bash
cd /Users/mk/c/ClaudeVST
python3 companions/tts/tts_watcher.py
```

Output:
```
TTS Watcher started
Voice: Daniel (Enhanced)
Watching: /Users/mk/c/ClaudeVST/messages/from_claude.json
Press Ctrl+C to stop
```

### How It Works

```python
# Poll for new responses
while True:
    if MESSAGES_PATH.exists():
        data = json.loads(MESSAGES_PATH.read_text())
        timestamp = data.get("timestamp", 0)
        response = data.get("response", "")

        if timestamp > last_timestamp and response:
            last_timestamp = timestamp
            speak(response, voice)

    time.sleep(0.3)  # Check 3x per second
```

### Voice Selection

The watcher tries voices in preference order:

```python
VOICES = [
    "Daniel (Enhanced)",  # UK English - user's preference
    "Samantha",           # US English
    "Zoe (Premium)",      # Premium if available
    "Alex",               # Default high-quality
]
```

To see available voices:
```bash
say -v ?
```

### Speech Parameters

```python
subprocess.run(["say", "-v", voice, "-r", "180", text])
#                      -v voice        -r rate (words/min)
```

---

## VST-Embedded TTS (Work in Progress)

The VST includes an AVSpeechSynthesizer implementation that outputs audio through the plugin's audio output.

### Architecture

```
Claude Response → SpeechSynthesizer.speak(text)
                        ↓
                AVSpeechSynthesizer
                        ↓
                Audio Buffer Queue
                        ↓
processBlock() → pullAudio() → DAW Output
```

### Current Status

- AVSpeechSynthesizer generates audio
- Audio is captured via AVAudioSession
- Sample rate conversion implemented
- **Challenge:** Thread safety between TTS generation and audio thread

### Fallback: Notification Beep

When a response arrives but TTS isn't ready, a notification beep plays:

```cpp
// Audio thread generates beep
if (beepRequested.load()) {
    for (int i = 0; i < samplesToGenerate; ++i) {
        float t = static_cast<float>(beepPhase++) / 44100.0f;
        float sample = 0.4f * std::sin(2.0f * 3.14159f * 880.0f * t);
        left[i] = sample;
        right[i] = sample;
    }
}
```

---

## VST TTS Flow

### 1. Response Received
```cpp
// PluginEditor.cpp
void ClaudeVSTAudioProcessorEditor::onClaudeResponse(const juce::String& response)
{
    appendToChat("Claude", response);
    processorRef.getSpeechSynthesizer().speak(response);
}
```

### 2. Speech Synthesis
```objc
// SpeechSynthesizer.mm
void SpeechSynthesizer::speak(const juce::String& text)
{
    AVSpeechUtterance* utterance = [[AVSpeechUtterance alloc]
        initWithString:nsText];
    utterance.voice = [AVSpeechSynthesisVoice voiceWithLanguage:@"en-US"];
    utterance.rate = 0.52;  // Slightly faster than default

    [impl->synthesizer speakUtterance:utterance];
}
```

### 3. Audio Capture
The AVSpeechSynthesizer writes to an audio buffer via delegate:

```objc
- (void)speechSynthesizer:(AVSpeechSynthesizer*)synth
    didOutputSpeechBuffer:(nonnull AVAudioBuffer*)buffer
{
    // Copy samples to ring buffer
    // (Requires sample rate conversion to match DAW)
}
```

### 4. Audio Output
```cpp
// PluginProcessor.cpp - processBlock()
int ttsWritten = speechSynthesizer.pullAudio(left, right, numSamples);
```

---

## Using Both Systems

For the best experience, use the standalone TTS watcher:

1. **Start TTS watcher** in terminal
2. **Load VST** in Ableton
3. **Send message** from VST
4. **Response appears** in chat AND is spoken through system audio

The VST's beep notification still works to indicate responses even if TTS watcher isn't running.

---

## Voice Quality Tips

### Best macOS Voices
- **Daniel (Enhanced)** - Natural UK English
- **Samantha** - Clear US English
- **Ava (Premium)** - Requires download

### Download Enhanced Voices
1. System Preferences → Accessibility → Spoken Content
2. Click "System Voice" dropdown
3. Select "Manage Voices..."
4. Download "Enhanced" or "Premium" variants

### Rate Adjustment

For long responses, faster rate improves usability:
```python
subprocess.run(["say", "-v", voice, "-r", "200", text])  # Faster
```

---

## Configuration

### tts_watcher.py Settings

```python
# File to watch
MESSAGES_PATH = Path.home() / "c/ClaudeVST/messages/from_claude.json"

# Voice preference (first available is used)
VOICES = ["Daniel (Enhanced)", "Samantha", "Zoe (Premium)", "Alex"]
```

### VST Settings

TTS parameters in `SpeechSynthesizer.mm`:
```objc
utterance.rate = 0.52;           // Speech rate (0.0-1.0)
utterance.pitchMultiplier = 1.0; // Pitch (0.5-2.0)
utterance.volume = 1.0;          // Volume (0.0-1.0)
```

---

## Troubleshooting

### No Speech Output (tts_watcher)
- Check `from_claude.json` exists and has content
- Verify system audio output device
- Try different voice: `say -v Samantha "test"`

### TTS Watcher Not Detecting Responses
- Ensure timestamp is newer than last processed
- Check file permissions on messages directory
- Verify JSON format is valid

### VST Beep But No TTS
- Use standalone tts_watcher.py instead
- VST TTS still work in progress

---

## Source Files

- `companions/tts/tts_watcher.py` - Standalone TTS service
- `src/SpeechSynthesizer.mm` - AVSpeechSynthesizer implementation
- `src/SpeechSynthesizer.h` - Interface
- `src/PluginProcessor.cpp:125` - Audio output mixing

---

## Running as Background Service

To run tts_watcher persistently:

```bash
# Run in background
nohup python3 /Users/mk/c/ClaudeVST/companions/tts/tts_watcher.py &

# Or use tmux/screen
tmux new -s tts
python3 companions/tts/tts_watcher.py
# Ctrl+B, D to detach
```

---

## See Also

- [WHISPER.md](WHISPER.md) - Voice input (speech-to-text)
- [MESSAGES.md](MESSAGES.md) - Response format
- [SYSTEM.md](SYSTEM.md) - Full voice I/O architecture
