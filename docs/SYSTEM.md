# Master System Overview

ClaudeVST is a complete voice-enabled AI assistant for music production in Ableton Live.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ABLETON LIVE                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          ClaudeVST Plugin                                ││
│  │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────────┐   ││
│  │  │ Audio Input   │──│ AudioAnalyzer  │──│ Spectrum/RMS/Peak        │   ││
│  │  │ (from DAW)    │  │ (FFT Analysis) │  │ → audio_analysis.json    │   ││
│  │  └───────────────┘  └────────────────┘  └──────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────────┐   ││
│  │  │ Voice Input   │──│SpeechRecognizer│──│ Whisper.cpp              │   ││
│  │  │ (Mic button)  │  │ (16kHz resamp) │  │ → transcribed text       │   ││
│  │  └───────────────┘  └────────────────┘  └──────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────────┐   ││
│  │  │ Chat UI       │──│ ClaudeClient   │──│ to_claude.json           │   ││
│  │  │ (text input)  │  │ (file I/O)     │  │ ← from_claude.json       │   ││
│  │  └───────────────┘  └────────────────┘  └──────────────────────────┘   ││
│  │                                                                          ││
│  │  ┌───────────────┐  ┌────────────────┐                                  ││
│  │  │ Audio Output  │──│SpeechSynthesiz │  (Beep notification)             ││
│  │  │ (to monitors) │  │ (TTS/Beep)     │                                  ││
│  │  └───────────────┘  └────────────────┘                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          AbletonOSC (Control Surface)                   ││
│  │                     ↕ OSC: localhost:11000/11001                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ JSON Files
                                    │
    ┌───────────────────────────────┼────────────────────────────────────┐
    │                               │                                     │
    │    /Users/mk/c/ClaudeVST/messages/                                 │
    │    ├── to_claude.json      (user message + audio context)          │
    │    ├── from_claude.json    (Claude response + actions)             │
    │    └── audio_analysis.json (real-time levels/spectrum)             │
    │                               │                                     │
    └───────────────────────────────┼────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼────────────────────────────────────┐
    │                               │                                     │
    │                        COMPANION SERVICES                           │
    │                                                                     │
    │    ┌─────────────────────────────────────────────────────────────┐ │
    │    │ Claude Code (Terminal)                                      │ │
    │    │ - Reads to_claude.json                                      │ │
    │    │ - Writes from_claude.json                                   │ │
    │    │ - Can include OSC actions in responses                      │ │
    │    └─────────────────────────────────────────────────────────────┘ │
    │                                                                     │
    │    ┌─────────────────────────────────────────────────────────────┐ │
    │    │ tts_watcher.py (Terminal)                                   │ │
    │    │ - Watches from_claude.json                                  │ │
    │    │ - Speaks responses via macOS 'say'                          │ │
    │    └─────────────────────────────────────────────────────────────┘ │
    │                                                                     │
    │    ┌─────────────────────────────────────────────────────────────┐ │
    │    │ voice_listener.py (Optional)                                │ │
    │    │ - Standalone voice input                                    │ │
    │    │ - Alternative to VST mic button                             │ │
    │    └─────────────────────────────────────────────────────────────┘ │
    │                                                                     │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Flow

### 1. User Sends Message (Voice)
```
User holds [Mic] → VST captures audio → Whisper transcribes
    → Text appears in input → Auto-send → to_claude.json written
```

### 2. User Sends Message (Text)
```
User types → Clicks Send → ClaudeClient writes to_claude.json
    → Includes audio context + Ableton session info
```

### 3. Claude Responds
```
Claude Code reads to_claude.json → Formulates response
    → Writes from_claude.json (with optional actions)
```

### 4. Response Displayed
```
VST polls from_claude.json → Detects new timestamp
    → Displays in chat → Triggers TTS/beep → Executes actions
```

### 5. Actions Execute
```
from_claude.json contains actions → OSCClient parses
    → Sends OSC to AbletonOSC → Ableton responds (mute/play/etc)
```

---

## Setup Checklist

### Prerequisites

- [ ] macOS 11+ (Big Sur or later)
- [ ] Ableton Live 10+ with AbletonOSC installed
- [ ] Claude Code subscription
- [ ] Xcode Command Line Tools
- [ ] CMake 3.22+ and Ninja

### First-Time Setup

1. **Clone Repository**
   ```bash
   cd ~/c
   git clone <repo> ClaudeVST
   cd ClaudeVST
   git submodule update --init  # JUCE, whisper.cpp
   ```

2. **Build Whisper.cpp Libraries** (if not pre-built)
   ```bash
   cd whisper.cpp
   cmake -B build -DBUILD_SHARED_LIBS=ON
   cmake --build build
   cp build/src/*.dylib ../lib/
   cp build/ggml/src/*.dylib ../lib/
   ```

3. **Download Whisper Model**
   ```bash
   cd whisper.cpp
   ./models/download-ggml-model.sh tiny
   ```

4. **Install AbletonOSC**
   ```bash
   cp -r /path/to/AbletonOSC ~/Music/Ableton/User\ Library/Remote\ Scripts/
   ```

5. **Build ClaudeVST**
   ```bash
   cd ~/c/ClaudeVST
   cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
   cmake --build build
   ./scripts/post_build.sh
   ```

6. **Enable in Ableton**
   - Preferences → Link/Tempo/MIDI → Control Surface: AbletonOSC
   - Preferences → Plug-Ins → Rescan
   - Add ClaudeVST to any track

---

## Running All Services Together

### Terminal 1: TTS Watcher
```bash
cd ~/c/ClaudeVST
python3 companions/tts/tts_watcher.py
```

### Terminal 2: Claude Code
```bash
cd ~/c/ClaudeVST
claude
# Or your preferred Claude Code invocation
```

### Ableton Live
1. Open project
2. Add ClaudeVST plugin to a track
3. Set track monitoring to "In" for voice input
4. Send messages via text or voice

---

## Data Flow Summary

| Data | From | To | File/Protocol | Frequency |
|------|------|-----|---------------|-----------|
| User message | VST | Claude Code | to_claude.json | On send |
| Audio context | VST | Claude Code | to_claude.json | With message |
| Audio analysis | VST | (monitoring) | audio_analysis.json | 2 Hz |
| Response | Claude Code | VST | from_claude.json | On response |
| Actions | Claude Code | VST | from_claude.json | With response |
| OSC commands | VST | Ableton | OSC :11000 | On action |
| OSC responses | Ableton | VST | OSC :11001 | On query |
| TTS output | tts_watcher | System audio | `say` command | On response |

---

## Troubleshooting Guide

### VST Won't Load in Ableton

1. **Check permissions added:**
   ```bash
   /usr/libexec/PlistBuddy -c "Print" ~/Library/Audio/Plug-Ins/VST3/ClaudeVST*.vst3/Contents/Info.plist | grep -i speech
   ```
   Should show `NSSpeechRecognitionUsageDescription`

2. **Run post_build.sh:**
   ```bash
   ./scripts/post_build.sh
   ```

3. **Rescan plugins:**
   Ableton Preferences → Plug-Ins → Rescan

### Messages Not Being Received

1. **Check file exists:**
   ```bash
   ls -la messages/
   cat messages/to_claude.json
   ```

2. **Verify timestamp format:**
   Should be Unix milliseconds (13 digits): `1768587202680`

3. **Check file permissions:**
   ```bash
   ls -la messages/
   # Should be readable/writable by user
   ```

### AbletonOSC Not Connecting

1. **Verify enabled:**
   Ableton Preferences → Control Surface should show "AbletonOSC"

2. **Check port availability:**
   ```bash
   lsof -i :11000
   lsof -i :11001
   ```

3. **Look for startup message:**
   ```bash
   tail ~/Library/Preferences/Ableton/Live*/Log.txt | grep -i osc
   ```

### Voice Not Working

1. **Check Whisper model:**
   ```bash
   ls -la whisper.cpp/models/ggml-tiny.bin
   ```

2. **Verify microphone access:**
   System Preferences → Privacy → Microphone → Ableton Live

3. **Test Whisper standalone:**
   ```bash
   ./whisper.cpp/build/bin/main -m whisper.cpp/models/ggml-tiny.bin -f test.wav
   ```

### TTS Not Speaking

1. **Check tts_watcher running:**
   ```bash
   ps aux | grep tts_watcher
   ```

2. **Test macOS say:**
   ```bash
   say "test"
   ```

3. **Verify from_claude.json:**
   ```bash
   cat messages/from_claude.json
   ```

---

## Performance Tips

- **Use tiny Whisper model** for fastest voice response
- **Keep responses concise** for faster TTS
- **Monitor CPU** - Whisper transcription uses significant CPU briefly
- **Close unused plugins** to reduce audio thread load

---

## Security Notes

- All communication is local (localhost only)
- No data leaves your machine unless you use Claude API
- File permissions should restrict access to your user
- OSC is unauthenticated - only run on trusted networks

---

## Directory Structure

```
/Users/mk/c/ClaudeVST/
├── CLAUDE.md              # Main development guide
├── docs/                  # Detailed documentation
│   ├── ABLETONOSC.md      # AbletonOSC integration
│   ├── MESSAGES.md        # Message format spec
│   ├── VST.md             # Plugin architecture
│   ├── WHISPER.md         # Voice recognition
│   ├── TTS.md             # Text-to-speech
│   └── SYSTEM.md          # This file
├── src/                   # Plugin source code
├── companions/            # Helper scripts
│   ├── tts/tts_watcher.py
│   └── voice/voice_listener.py
├── messages/              # Communication files
├── lib/                   # Pre-built libraries
├── whisper.cpp/           # Whisper submodule
├── JUCE/                  # JUCE submodule
├── build/                 # Build output
└── scripts/               # Build scripts
```

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - Quick start and development guide
- [ABLETONOSC.md](ABLETONOSC.md) - Ableton control details
- [MESSAGES.md](MESSAGES.md) - JSON format reference
- [VST.md](VST.md) - Build and plugin internals
- [WHISPER.md](WHISPER.md) - Voice recognition setup
- [TTS.md](TTS.md) - Text-to-speech options
