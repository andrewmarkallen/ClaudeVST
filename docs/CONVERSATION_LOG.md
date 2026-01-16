# ClaudeVST Development Conversation Log

**Date**: January 16, 2026
**Participants**: User (mk) + Claude Opus 4.5 (via Claude Code)

---

## Project Vision

The user wanted to create **ClaudeVST** - an AI-powered music production advisor that runs as a VST plugin inside Ableton Live. The core idea:

- **Stay inside the DAW** - No switching to browser/terminal for AI assistance
- **Real-time audio analysis** - Spectrum, levels, dynamics that MCP servers can't do
- **Context-aware advice** - Combines audio analysis with Ableton session data
- **Teaching tool** - For learning music production, not performance

---

## Architecture Evolution

### Initial Plan: Direct API Calls
The original plan had the VST calling the Anthropic Claude API directly. This would require:
- API key stored in config file
- HTTP requests from the plugin
- Full autonomy but costs money per request

### User Feedback: "Can't you just communicate arbitrarily?"
The user expected Claude Code to communicate with the VST directly, avoiding API costs since they already have a Claude subscription.

### Revised Plan: MCP Server in VST
Considered having the VST run an MCP server that Claude Code connects to. But MCP is for Claude Code to call tools, not receive messages.

### Final Architecture: File-Based Communication
Settled on file-based message passing:

```
ClaudeVST/messages/
├── to_claude.json      # VST writes user messages here
├── from_claude.json    # Claude Code writes responses here
└── audio_analysis.json # Real-time audio data (updated 2x/sec)
```

**Workflow**:
1. User types in VST chat UI (stays in Ableton)
2. VST writes message to `to_claude.json`
3. Claude Code (in background terminal) reads it
4. Claude responds by writing to `from_claude.json`
5. VST picks up response and displays it

**Tradeoff**: Not fully autonomous - requires Claude Code session running. But uses subscription, no extra API cost.

---

## Implementation Details

### Tech Stack
- **Framework**: JUCE 8 (industry standard for audio plugins)
- **Language**: C++17
- **Build**: CMake + Ninja
- **Formats**: VST3 + AU (for Ableton + Logic)
- **macOS Frameworks**: Speech (recognition), AVFoundation (TTS)

### Source Files

| File | Purpose |
|------|---------|
| `PluginProcessor.cpp/h` | Audio processing, hosts analyzer and TTS |
| `PluginEditor.cpp/h` | Chat UI (dark Ableton theme) |
| `ClaudeClient.cpp/h` | File-based message passing |
| `AudioAnalyzer.cpp/h` | FFT spectrum + RMS/peak levels |
| `OSCClient.cpp/h` | AbletonOSC integration |
| `SpeechRecognizer.mm/h` | macOS speech-to-text input |
| `SpeechSynthesizer.mm/h` | macOS text-to-speech output |

### Audio Analysis
8-band spectrum analysis:
- Sub (20-60 Hz)
- Bass (60-250 Hz)
- Low-Mid (250-500 Hz)
- Mid (500-2000 Hz)
- Upper-Mid (2000-4000 Hz)
- Presence (4000-6000 Hz)
- Brilliance (6000-12000 Hz)
- Air (12000-20000 Hz)

Plus: RMS levels (L/R), Peak levels (L/R), Crest factor (dynamics)

### AbletonOSC Integration
Uses standard AbletonOSC (github.com/ideoforms/AbletonOSC):
- Send port: 11000
- Receive port: 11001

Can query:
- Tempo, time signature
- Track names, count
- Device parameters (read AND write!)
- Clip information

Potential for voice commands like "mute the bass track" or "set tempo to 128"

---

## Features Implemented

### 1. Chat UI
- Dark theme matching Ableton aesthetic
- Text input with Enter to send
- Scrollable chat history
- Real-time level display at top

### 2. Audio Analysis
- FFT-based spectrum analysis (2048 samples, Hann window)
- RMS and peak metering
- Crest factor for dynamics assessment
- Data written to JSON for Claude to read

### 3. Voice Input (Speech Recognition)
- macOS SFSpeechRecognizer API
- Hold [Mic] button to speak
- Releases, transcribes, and sends automatically
- Requires microphone + speech recognition permissions

### 4. Voice Output (Text-to-Speech)
- macOS AVSpeechSynthesizer API
- Claude's responses spoken through VST audio output
- Mixed into plugin's output buffer (goes through Ableton mixer)
- Allows hearing responses through monitors

### 5. Timestamped Builds
- Plugin name includes build timestamp (e.g., ClaudeVST_0116_1547)
- Prevents Ableton from caching old versions
- Makes iteration faster during development

---

## Challenges & Solutions

### Challenge: Ableton Caches Plugins
**Problem**: After rebuilding, Ableton loads old cached version.
**Solution**: Timestamp in plugin name forces Ableton to treat as new plugin.

### Challenge: macOS Privacy Permissions
**Problem**: Plugin crashes without proper Info.plist entries.
**Solution**: Post-build script adds NSSpeechRecognitionUsageDescription and NSMicrophoneUsageDescription, then re-signs.

### Challenge: Autonomous Message Handling
**Problem**: User wants to stay in Ableton, not keep switching to Claude Code.
**Partial Solution**: Background file watcher, but Claude Code requires user confirmation for long-running commands.
**Full Solution**: Would require Claude API (costs money) or local LLM.

### Challenge: TTS Audio in VST
**Problem**: Need to route synthesized speech through VST output, not system speakers.
**Solution**: AVSpeechSynthesizer.writeUtterance() captures audio to buffer, which gets mixed into processBlock() output.

---

## Testing Sessions

### Session 1: Basic Chat
- User typed "Hey! Can you hear me :)" from VST
- Claude Code read the file and responded
- Response appeared in VST chat UI
- **Success!**

### Session 2: Audio Analysis
- User played psytrance through the plugin
- Spectrum showed: Sub/Bass ~38dB, rolling off to highs
- Crest factor ~6dB (typical for compressed electronic music)
- Claude correctly identified genre characteristics from spectrum

### Session 3: Voice Input
- User spoke into microphone
- Mono left channel visible in analysis
- Speech-like spectrum (sub/bass fundamental, rolling off highs)
- Voice-to-text transcription working

---

## Future Possibilities

### 1. Full AbletonOSC Control
- "Mute the bass track"
- "Set tempo to 128"
- "What effects are on the master?"
- Read AND write device parameters

### 2. Hybrid LLM Approach
- Local model (Ollama) for quick queries
- Claude API for complex mixing advice
- Reduces latency and cost

### 3. Enhanced Audio Visualization
- Spectrum display in the UI
- Waveform view
- Loudness metering (LUFS)

### 4. Session Context
- Track names in prompts
- Current device chains
- Playing clip information

---

## Commands Reference

### Build
```bash
cd /Users/mk/c/ClaudeVST
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh  # Add permissions
```

### Watch for Messages
```bash
# Manual check
cat messages/to_claude.json

# Respond
echo '{"timestamp": 123, "response": "Your message here"}' > messages/from_claude.json
```

### Clean Old Plugins
```bash
rm -rf ~/Library/Audio/Plug-Ins/VST3/ClaudeVST*.vst3
rm -rf ~/Library/Audio/Plug-Ins/Components/ClaudeVST*.component
```

---

## Lessons Learned

1. **File-based IPC is simple and effective** for non-real-time communication
2. **macOS permissions** require explicit plist entries - can't be added at runtime
3. **Plugin name timestamps** solve caching issues elegantly
4. **TTS through VST** requires capturing to buffer, not just speaking
5. **Claude Code subscription** doesn't extend to API calls - they're separate billing

---

## Repository Structure

```
ClaudeVST/
├── CMakeLists.txt          # Build configuration
├── Info.plist              # Privacy permissions (template)
├── CLAUDE.md               # Instructions for Claude Code
├── JUCE/                   # JUCE framework (git submodule)
├── src/
│   ├── PluginProcessor.cpp/h
│   ├── PluginEditor.cpp/h
│   ├── ClaudeClient.cpp/h
│   ├── AudioAnalyzer.cpp/h
│   ├── OSCClient.cpp/h
│   ├── SpeechRecognizer.mm/h
│   └── SpeechSynthesizer.mm/h
├── scripts/
│   └── post_build.sh       # Adds permissions, re-signs
├── messages/               # Runtime message files
│   ├── to_claude.json
│   ├── from_claude.json
│   └── audio_analysis.json
├── docs/
│   └── CONVERSATION_LOG.md # This file
└── build/                  # Build output (gitignored)
```

---

*End of conversation log*
