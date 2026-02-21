# ClaudeVST — AI Mentor for Techno Producers

ClaudeVST is an AI music production mentor built into Ableton Live as a VST plugin. The goal is to help an intermediate techno producer level up to professional releases by providing the same kind of guidance a skilled developer gets from an LLM when navigating unfamiliar territory: real answers, specific parameters, genre knowledge, and hands-on control of the DAW.

---

## The Vision

Most music production AI tools are either too generic ("try adding compression") or too prescriptive ("set attack to 10ms"). This system aims to work like having an experienced producer in the room who:

- Listens to what you're working on in real time
- Knows the genre deeply (hypnotic techno, BCCO Records style, 125–132 BPM)
- Gives specific, actionable feedback with actual parameter values
- Can reach into Ableton and make changes, not just describe them
- Understands where you are in your skill development and coaches accordingly

The teacher is Claude (via Claude Code), embedded in the workflow through a VST plugin that sits in Ableton Live.

---

## How It Works

```
You speak or type in Ableton
        ↓
VST plugin captures audio context (spectrum, levels, session state)
        ↓
Message written to messages/to_claude.json
        ↓
Teacher agent (Claude Code) reads the file, analyzes context
        ↓
Teacher queries Ableton state via MCP tools (delta-cached for efficiency)
        ↓
Teacher searches indexed documentation (Ableton manual, plugin references)
        ↓
Teacher applies coaching diagnostics and knowledge base
        ↓
Response written to messages/from_teacher.json
        ↓
TTS watcher speaks the response aloud (macOS say command)
VST displays it in chat UI and executes any requested Ableton actions
```

Everything runs locally. No cloud APIs for voice, analysis, or embeddings. The only LLM call is Claude Code, which the user already has a subscription to.

---

## Architecture

The system has four layers that communicate with each other:

### 1. VST Plugin (C++/JUCE)

The plugin lives inside Ableton Live. It handles:

- **Chat UI** — Type or speak messages, see responses
- **Voice input** — Hold [Mic] button, Whisper.cpp transcribes locally
- **Audio analysis** — 8-band FFT spectrum + RMS/peak/crest factor at 2Hz
- **File messaging** — Writes `to_claude.json`, polls `from_claude.json`
- **Ableton actions** — Executes `actions` in response JSON via REST API
- **TTS output** — Currently: beep notification. In progress: full speech through VST output

The plugin is named with a timestamp (e.g., `ClaudeVST_0121_1430.vst3`) to force Ableton to reload it without restarting when you build a new version.

### 2. Unified Bridge (TypeScript/Node.js)

Middleware that sits between Claude Code and Ableton Live. Provides two interfaces:

**MCP server (for Claude Code):** 30+ tools for querying and controlling Ableton. Claude uses these like function calls during a conversation.

**REST API (for VST):** HTTP endpoints the C++ plugin calls to execute Ableton commands.

Both interfaces connect to a Python Remote Script running inside Ableton via TCP on port 9877.

Key feature: **delta caching** — tracks what Claude has already seen and returns only changed data, saving 85–95% of tokens on repeated session queries.

### 3. Ableton Remote Script (Python)

A custom Python script installed in Ableton's User Library. It listens on TCP port 9877 and handles:

- Reading session state (tempo, tracks, devices, parameters)
- Creating and editing clips, tracks, MIDI notes
- Loading instruments and effects from the browser
- Transport control
- Audio file import

### 4. Claude Code (Intelligence Layer)

The teacher agent runs in a Claude Code terminal. It:

- Monitors `messages/to_claude.json` for user messages
- Uses MCP tools to query Ableton state
- Searches indexed documentation for relevant information
- Applies the coaching knowledge base to diagnose issues
- Writes responses to `messages/from_teacher.json`

The same Claude Code session also serves as the development environment — this is why there's no separate API integration. The user's existing Claude subscription powers everything.

---

## Components in Detail

### Audio Analysis (In-VST)

The plugin analyzes audio in real time and attaches context to every message:

| Band | Range |
|------|-------|
| Sub | 20–60 Hz |
| Bass | 60–250 Hz |
| Low-Mid | 250–500 Hz |
| Mid | 500–2,000 Hz |
| Upper-Mid | 2,000–4,000 Hz |
| Presence | 4,000–6,000 Hz |
| Brilliance | 6,000–12,000 Hz |
| Air | 12,000–20,000 Hz |

Also reports: RMS level, peak level, crest factor (dynamics indicator).

Targets for hypnotic techno: RMS around –14 dB, crest factor 6–10 dB, strong sub/bass presence (30+ dB).

### Voice Input (Whisper.cpp)

- Hold [Mic] button to record
- Releases to transcribe automatically
- Uses the ggml-tiny model (~75MB, ~1 second transcription)
- GPU-accelerated via Metal on Apple Silicon
- No macOS TCC permissions needed (pure C++ library, not system speech framework)
- Audio resampled from DAW rate to 16 kHz for Whisper

### Reference Track Analysis

When you load a reference track, the system runs a custom segmentation pipeline designed for techno and psytrance:

1. **Beat tracking** — Detects tempo (corrected to 110–190 BPM range) and finds downbeats
2. **Feature extraction** — 9-dimensional beat features (RMS, spectral flux, centroid, band ratios, onset density)
3. **Boundary detection** — Self-similarity matrix with checkerboard novelty, snapped to 4-bar grid
4. **Labeling** — Structural labels (A, B, C, A', A+fill) and functional labels (intro, groove, break, drop, outro, transition)

Fallback services for additional analysis:
- **allin1** — Deep learning segmentation (WASPAA 2023)
- **MSAF** — Traditional signal processing

CLI usage:
```bash
cd packages/unified-bridge
npm run analyze -- /path/to/track.wav
```

### Document Search

The system has indexed the following documentation into a local vector database (LanceDB + Ollama embeddings):

- Ableton Live 12 Manual (full, ~83 MB, ~10,000 chunks)
- Eventide H90 Manual
- All system documentation (19 markdown files)

The teacher agent can search this semantically — "how does Ableton's frequency shifter work?" — without sending any data to the cloud.

### Coaching Knowledge Base

Built into the Unified Bridge, the coaching system maps symptoms to causes to fixes:

**`diagnose_sound_issue`** — Takes a symptom ("kick sounds muddy") and returns likely causes and specific remedies with parameter values.

**`analyze_track_chain`** — Reviews the order and settings of devices on a track and flags problems.

**`compare_to_target`** — Compares current audio analysis data to hypnotic techno targets and identifies what's off.

The knowledge base covers: kick/low-end issues, high frequency problems, dynamics, stereo width, saturation, reverb, and more.

---

## File-Based Messaging

All communication between the VST and Claude uses JSON files in the `messages/` directory:

| File | Direction | Content |
|------|-----------|---------|
| `messages/to_claude.json` | VST → Claude | User message + audio context + session state |
| `messages/from_claude.json` | Claude → VST | Response text + optional Ableton actions |
| `messages/from_teacher.json` | Teacher → VST | Teacher agent responses |
| `messages/to_master.json` | VST → Master | Messages prefixed with "M:" for development coordination |
| `messages/audio_analysis.json` | VST → Claude | Real-time audio data, updated at 2 Hz |

**Why file-based?** Claude Code cannot receive push notifications, but it can read files. This sidesteps the need for a separate API integration and keeps everything running on the existing subscription.

---

## Repository Structure

```
src/                    # C++ VST plugin (JUCE framework)
packages/
├── unified-bridge/     # MCP server + REST API + CLI
├── analysis/           # Audio analysis post-processing
└── shared/             # Shared utilities
services/
├── genre-segmenter/    # Custom techno/psytrance track segmenter
├── allin1/             # Deep learning segmenter (Docker)
├── msaf/               # Fallback segmenter (Docker)
└── document-mcp/       # Semantic document search (LanceDB + Ollama)
agents/
└── teacher/            # Teacher agent instructions
data/
├── teacher-state/      # Student progress tracking
├── reference-docs/     # Archived sound design conversations
└── manuals/            # Reference PDFs (Ableton, H90, etc.)
io/
├── tts/                # Standalone TTS watcher (macOS say)
└── voice/              # Standalone voice input alternative
docs/                   # Extended documentation
messages/               # Runtime communication directory
scripts/                # Build and deployment scripts
lib/                    # Pre-built whisper.cpp libraries
whisper.cpp/            # Submodule: speech recognition
JUCE/                   # Submodule: VST/AU framework
```

---

## Build & Setup

### Prerequisites

- macOS (required for JUCE VST/AU targets and AVFoundation)
- Ableton Live 11 or 12
- CMake + Ninja
- Node.js (for Unified Bridge)
- Python 3.10+ (for Remote Script and analysis services)
- Ollama (for local document embeddings)

### Build the VST Plugin

```bash
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh  # Required: adds permissions, re-signs plugin
```

After building, rescan plugins in Ableton (Preferences → Plug-Ins → Rescan) and look for the new timestamped plugin name.

### Start the Unified Bridge

```bash
cd packages/unified-bridge
npm install
npm run build
# MCP mode (for Claude Code integration)
MODE=mcp node dist/index.js
# REST mode (for VST HTTP client)
MODE=rest node dist/index.js
# Both simultaneously
MODE=both node dist/index.js
```

### Install the Ableton Remote Script

Copy the Remote Script into Ableton's User Library and enable it under Preferences → Link/Tempo/MIDI → MIDI Remote Scripts.

### Start Document Search (Optional)

```bash
cd services/document-mcp
uv run python -m src.main
```

---

## Current Status

| Component | Status |
|-----------|--------|
| Unified Bridge (MCP + REST) | Complete |
| Ableton control (30+ tools) | Complete |
| Audio analysis (FFT, RMS, crest factor) | Working |
| Voice input (Whisper.cpp) | Working |
| Chat UI in VST | Working |
| File-based messaging | Working |
| Reference track analysis | Working |
| Document indexing and search | Complete |
| Coaching tools | Complete |
| Voice output / TTS | Partial (beep only, full TTS in progress) |
| Teacher agent | Infrastructure complete, prompt tuning pending |
| Streaming responses | Not started |
| LUFS metering | Not started |
| Transient detection | Not started |

---

## Development Status

The system is currently in **builder mode** — the architecture is being assembled, not yet used as a teaching tool in regular sessions. The development workflow uses Claude Code itself to build components, with agent-driven development for larger features.

Items out of scope until the core is complete:
- Teacher prompt tuning
- Claude API integration (using Code subscription instead)
- VST UI polish (terminal-first for now)

---

## Genre Context

The system is tuned for **hypnotic techno** in the style of labels like BCCO Records:

- Tempo: 125–132 BPM (BCCO sweet spot: 126–128)
- Structure: Long, evolving arrangements with gradual builds and releases
- Sound design: Synthesized drums, layered bass, shifting textures
- Mix targets: Strong sub presence, heavily compressed (crest factor 6–10 dB), designed for club systems
- Arrangement: 32-bar structural units, tension built through addition/subtraction rather than filter sweeps

---

## Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Full technical architecture and component relationships
- [docs/SYSTEM.md](docs/SYSTEM.md) — Setup checklist and troubleshooting guide
- [docs/MESSAGES.md](docs/MESSAGES.md) — JSON message format specification
- [docs/VST.md](docs/VST.md) — Plugin build process, threading model, source file reference
- [docs/WHISPER.md](docs/WHISPER.md) — Voice recognition setup and model options
- [docs/TTS.md](docs/TTS.md) — Text-to-speech services
- [docs/UNIFIED_BRIDGE.md](docs/UNIFIED_BRIDGE.md) — MCP/REST server documentation
- [docs/GENRE-SEGMENTER.md](docs/GENRE-SEGMENTER.md) — Reference track segmentation algorithm
- [docs/ABLETONOSC.md](docs/ABLETONOSC.md) — Legacy OSC integration reference
