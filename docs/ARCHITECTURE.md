# ClaudeVST System Architecture

Comprehensive technical overview of all components in the ClaudeVST AI mentor system for techno production.

---

## Vision

An AI mentor system for techno production, helping intermediate producers reach professional level with contextual, audio-aware guidance in Ableton Live.

---

## High-Level Data Flow

```
┌─────────────────┐     JSON Files      ┌─────────────────┐
│   Ableton Live  │◄──────────────────►│  Claude Code    │
│   + ClaudeVST   │   messages/*.json   │   (Terminal)    │
└────────┬────────┘                     └────────┬────────┘
         │                                       │
         │ TCP :9877                             │ MCP (stdio)
         │                                       │
┌────────▼────────────────────────────────────────▼────────┐
│                    Unified Bridge                         │
│              (TypeScript - Node.js server)                │
└──────────────────────────────────────────────────────────┘
```

---

## Components

### 1. ClaudeVST Plugin (C++/JUCE)
*Location: `src/`*

The VST3/AU plugin that runs inside Ableton Live.

- **PluginProcessor.cpp/h** (~150 lines)
  - Audio callback (`processBlock`) runs on real-time audio thread
  - Hosts AudioAnalyzer and SpeechSynthesizer
  - Routes audio to/from DAW

- **PluginEditor.cpp/h** (~220 lines)
  - Chat UI with text input and message history
  - Voice recording button (hold to speak)
  - Audio level meter display
  - Reference track loader UI (Apply to Session/Arrangement)

- **AudioAnalyzer.cpp/h** (~150 lines)
  - 8-band FFT spectrum analysis (sub through air)
  - RMS/peak level metering per channel
  - Crest factor calculation
  - Writes `audio_analysis.json` at 2Hz

- **ClaudeClient.cpp/h** (~120 lines)
  - File-based I/O for message passing
  - Reads `from_claude.json` (Claude's responses)
  - Writes `to_claude.json` (user messages + audio context)
  - Polls for new responses

- **SpeechRecognizer.mm/h** (~130 lines)
  - Whisper.cpp integration (local transcription)
  - Resamples VST input to 16kHz
  - No macOS permissions needed (not using Apple Speech)

- **SpeechSynthesizer.mm/h** (~180 lines)
  - Currently: beep notification on response arrival
  - Planned: Full TTS through VST output via AVSpeechSynthesizer
  - Thread-safe communication via atomic flags

- **UnifiedBridgeClient.cpp/h**
  - REST API client for Ableton control
  - Creates tracks, clips, sets properties
  - Used by reference track loader feature

- **ReferenceTrackData.cpp/h**
  - Parses reference track analysis JSON
  - Hierarchical segment data (levels/segments)
  - Tempo, duration, file path storage

---

### 2. Unified Bridge (TypeScript/Node.js)
*Location: `companions/unified-bridge/`*

Middleware server providing Ableton control to both Claude Code and the VST.

- **index.ts**
  - Entry point with mode selection (mcp/rest/both)
  - Initializes AbletonClient and DeltaCache
  - Manages lifecycle of servers

- **mcp-server.ts**
  - MCP protocol implementation (stdio)
  - 30+ tools for Ableton control
  - Direct Claude Code integration

- **rest-api.ts** (Fastify)
  - HTTP endpoints for C++ VST adapter
  - `/command` endpoint for generic commands
  - Session, track, device, transport endpoints
  - Cache management endpoints

- **ableton-client.ts**
  - TCP client to Ableton Remote Script (port 9877)
  - JSON command/response protocol
  - Auto-reconnect on failure

- **delta-cache.ts**
  - 85-95% token savings on repeated queries
  - Tracks changes in session/track/device state
  - Returns only modified fields

- **device-presets.ts**
  - Curated presets for common devices
  - Granulator, Wavetable, AutoFilter presets
  - Batch parameter application

---

### 3. Ableton Remote Script (Python)
*Location: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/`*

Python control surface running inside Ableton Live (required by Ableton's API).

- **__init__.py** (~1600+ lines)
  - TCP server on port 9877
  - JSON command router
  - Session info, track info, device parameters
  - Clip creation, note manipulation
  - Browser navigation and item loading
  - Transport control, tempo setting
  - Audio clip creation (session & arrangement)
  - Clip start/end marker setting

---

### 4. Message Files (JSON)
*Location: `messages/`*

File-based communication between VST and Claude Code.

- **to_claude.json**
  - User message text
  - Audio context (spectrum, levels)
  - Timestamp (Unix ms)

- **from_claude.json**
  - Claude's response text
  - Optional OSC actions
  - Timestamp (Unix ms)

- **audio_analysis.json**
  - Real-time levels (RMS, peak, crest factor)
  - 8-band spectrum (sub through air, in dB)
  - Updated at 2Hz

---

### 5. Companion Services

- **tts_watcher.py** (`companions/tts/`)
  - Watches `from_claude.json` for new responses
  - Speaks via macOS `say` command
  - Runs in separate terminal

- **voice_listener.py** (`companions/voice/`) [Optional]
  - Standalone voice input alternative
  - For when VST mic button isn't convenient

---

### 6. Coaching Tools (in Unified Bridge)

- **diagnose_sound_issue**
  - Maps symptoms ("kick sounds muddy") to causes
  - Suggests specific fixes with parameter values

- **analyze_track_chain**
  - Audits device chain for issues
  - Identifies problematic ordering, missing processors

- **compare_to_target**
  - Compares audio analysis to techno production targets
  - Identifies spectrum imbalances

---

### 7. External Dependencies

- **JUCE** (submodule)
  - C++ audio framework for VST/AU plugin
  - UI components, audio processing

- **whisper.cpp** (submodule)
  - Local speech-to-text
  - Model: `ggml-tiny.bin` (~75MB)
  - No cloud/API required

---

## Communication Protocols

| Path | Protocol | Port | Purpose |
|------|----------|------|---------|
| Claude Code ↔ Unified Bridge | MCP (stdio) | - | Tool invocations |
| VST ↔ Unified Bridge | HTTP REST | 8080/9100 | Ableton commands |
| Unified Bridge ↔ Ableton | TCP JSON | 9877 | Remote Script commands |
| VST ↔ Claude Code | File I/O | - | Messages, audio data |

---

## Build Artifacts

- `ClaudeVST_MMDD_HHMM.vst3` → `~/Library/Audio/Plug-Ins/VST3/`
- `ClaudeVST_MMDD_HHMM.component` → `~/Library/Audio/Plug-Ins/Components/`
- Timestamped names force Ableton to reload without restart

---

## Why This Architecture?

1. **File-based messaging** - Uses Claude Code subscription (no API costs), Claude Code can't receive push messages
2. **Unified Bridge** - Single TypeScript server serves both MCP (Claude Code) and REST (VST)
3. **Remote Script in Python** - Ableton requires Python for control surface scripts
4. **Local Whisper** - No macOS TCC permissions, no cloud latency
5. **Delta caching** - Massive token savings for repeated Ableton queries

---

## 8. Documentation & Knowledge Base for Claude Teacher

The Claude Teacher (AI mentor) has access to indexed documentation and domain-specific knowledge for providing expert guidance.

### Document Indexing System
*Location: MCP server `claudevst-docs`*

Uses semantic vector search (LanceDB + Ollama embeddings) for retrieval-augmented generation.

- **Search Tools:**
  - `search_documents(query)` - Natural language semantic search
  - `get_catalog()` - List all indexed documents
  - `reindex_document(path)` - Force update on specific file

- **Indexed Content (84.79 MB, 10,001+ chunks):**
  - Ableton Live 12 Manual (83.5 MB) - Complete DAW reference
  - Eventide H90 Manual (5.2 MB) - Effects processor reference
  - All ClaudeVST system docs (19 markdown files)
  - Teacher agent instructions

### Core Documentation Files
*Location: `docs/`*

| Document | Purpose |
|----------|---------|
| `SYSTEM.md` | Full architecture diagram, setup checklist, troubleshooting |
| `MESSAGES.md` | JSON message format spec for all communication files |
| `VST.md` | Build process, threading model, source file overview |
| `ABLETONOSC.md` | OSC commands for Ableton control (legacy) |
| `WHISPER.md` | Voice recognition setup and model options |
| `TTS.md` | Text-to-speech services configuration |
| `UNIFIED_BRIDGE.md` | MCP/REST server documentation |
| `DOCUMENT_INDEXING.md` | How semantic search works |
| `PRODUCTION_EXPERTISE_RESEARCH.md` | Techno production targets and knowledge gaps |

### Production Expertise Knowledge
*Location: `docs/PRODUCTION_EXPERTISE_RESEARCH.md`*

Genre-specific knowledge the teacher uses for coaching:

- **Hypnotic Techno Targets:**
  - Tempo: 125-132 BPM (BCCO style: 126-128)
  - Crest factor: 6-10 dB
  - Frequency spectrum targets by band
  - Arrangement structure (32-bar patterns)
  - Mastering targets (-6 to -8 dB RMS, -7 to -8 LUFS)

- **Sound Design Patterns:**
  - FM bass: 3-operator + sine sub
  - Pads: Wavetable with 2-4s reverb decay
  - Drums: Punchy, minimal, tight compression

- **Mixing Guidelines:**
  - Sidechain: Kick triggers bass (6dB reduction)
  - High-pass at 20Hz
  - Narrow Q cuts for problems

### Coaching Knowledge Base
*Location: `companions/unified-bridge/src/coaching/knowledge-base.ts`*

Diagnostic patterns mapping symptoms to fixes:

- **Patterns Covered:**
  - Kick/low-end issues (muddy, buried, disappearing)
  - High frequency issues (harsh highs, midrange holes)
  - Dynamics issues (over-compression, lifeless)
  - Stereo/width issues (mono collapse)
  - Saturation/warmth (too clean, digital)
  - Reverb issues (washy, cloudy)

- **Pattern Structure:**
  ```typescript
  {
    symptoms: ["muddy kick", "kick not punchy"],
    rootCauses: ["Too much sub overlap", "Reverb not EQ'd"],
    fixes: [{ device: "EQ Eight", parameter: "Low Cut", range: "50-60 Hz" }],
    explanation: "Kick and rumble fight for sub frequencies..."
  }
  ```

### Coaching Plan Documentation
*Location: `docs/plans/2026-01-17-sound-design-coaching-plan.md`*

Implementation plan for the coaching system:

- Task-by-task breakdown
- Code snippets for all modules
- Test specifications
- Integration instructions

### Teacher Agent Configuration
*Location: `claude-plugins/teacher-agent/commands/teacher.md`*

Defines the autonomous teacher's capabilities:

- **Teaching Domains:**
  - Music theory (scales, harmony, rhythm)
  - Sound design (FM, subtractive, wavetable synthesis)
  - Mixing/mastering for club systems
  - Genre-specific techniques (techno, house, DnB)

- **Operational Mode:**
  - Polls `messages/to_claude.json` every 2 seconds
  - Detects new messages via timestamp
  - Processes with full audio context
  - Writes responses to `messages/from_teacher.json`
  - Maintains conversation context across sessions

### Knowledge Gaps (To Address)
*From `PRODUCTION_EXPERTISE_RESEARCH.md`*

1. Sound design depth - No synthesis tutorials (FM, wavetable)
2. Arrangement mastery - Limited 32-bar structure guidance
3. Mixing specifics - No EQ curves or compression settings for techno
4. Groove & timing - No swing/pocket guides
5. Music theory - No minor key progressions for electronic
6. BCCO specifics - Only generic label characteristics

---

## Complete Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                   │
│  Ableton Live + ClaudeVST Plugin (voice input, chat UI, audio analysis)      │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ JSON Files (messages/*.json)
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                              CLAUDE CODE                                      │
│  Claude Teacher (reads messages, writes responses, uses MCP tools)           │
│  ├── Document Search (semantic retrieval from indexed docs)                  │
│  ├── Coaching Tools (diagnose issues, analyze chains, compare to targets)    │
│  └── Ableton Control (via MCP tools)                                         │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ MCP (stdio) + REST (HTTP :8080)
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                           UNIFIED BRIDGE                                      │
│  TypeScript server with delta caching, coaching modules, REST API            │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │ TCP (localhost:9877)
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                        ABLETON REMOTE SCRIPT                                  │
│  Python control surface inside Ableton (required by Ableton API)             │
└──────────────────────────────────────────────────────────────────────────────┘

KNOWLEDGE LAYER (indexed & searchable):
├── Ableton Live 12 Manual (83.5 MB)
├── System Documentation (19 files)
├── Coaching Knowledge Base (diagnostic patterns)
├── Production Expertise (techno targets, mixing guides)
└── Teacher Agent Instructions
```

---

## See Also

- [SYSTEM.md](SYSTEM.md) - Setup checklist and troubleshooting
- [CLAUDE.md](../CLAUDE.md) - Quick start development guide
- [UNIFIED_BRIDGE.md](UNIFIED_BRIDGE.md) - MCP/REST server details
- [PRODUCTION_EXPERTISE_RESEARCH.md](PRODUCTION_EXPERTISE_RESEARCH.md) - Techno production knowledge

---

*Last updated: January 21, 2026*
