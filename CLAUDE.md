# CLAUDE.md - ClaudeVST

## Vision

ClaudeVST is an AI mentor system for becoming a professional techno producer.

**The Goal:** Help an intermediate producer level up to professional (record releases) by providing the same kind of guidance an experienced developer gets from an LLM when navigating unfamiliar code.

**What that means:**
- Real answers a knowledgeable human could give (no generic LLM fluff)
- Genre knowledge: formalisms, best practices, anti-patterns
- Workflow coaching: Ableton mastery, professional habits, finishing tracks
- Contextual help: "Why does this sound off?" with actual audio analysis
- Skill development: building intuition, ear training, getting fast

**Teaching Philosophy:**
- Not too rigid (no prescriptive one-size-fits-all rules)
- Not too loose (specific, actionable feedback with parameter values)
- Modern LLM at core (scope is huge, can search internet, reference manuals)

**The System = The Teacher:** The tutor is an LLM that knows all system capabilities, what it can do, what it's expected to do, and what the assumptions are.

---

## Builder Mode (Current Phase)

The system is under construction. Claude (in Claude Code) is building the teaching system, not yet operating as the teacher.

**Workflow:**
- Use superpowers skills for all development work
- Follow subagent-driven development for plan execution
- Use brainstorming skill before any new feature work

**Critical Discipline:**
- **Re-read this CLAUDE.md** at the start of each task in a plan
- **Re-read this CLAUDE.md** after every context compaction
- This ensures alignment with the vision as context evolves

**In Scope (Builder):**
- Unified Bridge (MCP/REST server for Ableton control)
- Audio analysis capabilities in VST
- Coaching tools and diagnostic patterns
- Documentation updates

**Out of Scope (for now):**
- Teacher prompt tuning (system not complete yet)
- Claude API integration (using Claude Code subscription)
- VST UI polish (terminal-first)

---

## Capability Log

*What's built and working. Updated after each major addition.*

### Unified Bridge (TypeScript)
- **Status:** Complete
- MCP tools for Claude Code integration
- REST API for C++ VST adapter
- Delta caching (85-95% token savings on repeated queries)
- Standalone CLI for reference track analysis
- Location: `packages/unified-bridge/`

### Ableton Control
- **Status:** Complete
- Session info, track info, device parameters
- Create tracks, clips, add notes
- Transport control, tempo
- Browser navigation, instrument loading
- Parameter search by name, batch operations
- Return tracks and master track access

### Audio Analysis (VST)
- **Status:** Working
- 8-band FFT spectrum
- RMS/peak levels, crest factor
- Updated at 2Hz
- Location: `src/AudioAnalyzer.cpp`

### Coaching Tools
- **Status:** Complete
- `diagnose_sound_issue` - Symptom to causes to fixes
- `analyze_track_chain` - Device chain audit
- `compare_to_target` - Mix vs techno targets
- Knowledge base with diagnostic patterns

### Voice I/O
- **Status:** Partial
- Voice input: Whisper.cpp working
- Voice output: Beep notification only (full TTS in progress)

### Reference Track Analysis
- **Status:** Working
- **Genre Segmenter** (primary): Custom algorithm for techno/psytrance
  - Beat tracking with tempo range 110-190 BPM
  - Structural labels: A/B/C with variations (A', A+fill)
  - Functional labels: intro/groove/break/drop/outro/transition
  - See: `docs/GENRE-SEGMENTER.md` for algorithm details
- allin1 (WASPAA 2023) fallback for semantic labels
- MSAF fallback for when allin1 unavailable
- Bar-aligned segment boundaries (4-bar quantization)
- 3-level hierarchy (coarse/medium/fine)
- CLI: `cd packages/unified-bridge && npm run analyze -- track.wav`
- Docker services: `services/genre-segmenter/`, `services/allin1/`, `services/msaf/`

---

## Codebase Structure

```
src/                    # C++ VST plugin
packages/               # TypeScript monorepo
├── unified-bridge/     # MCP + REST server + CLI
├── analysis/           # Audio analysis post-processing
└── shared/             # Shared utilities
services/               # Docker containers & MCP servers
├── genre-segmenter/    # Custom techno/psytrance analyzer
├── allin1/             # allin1 semantic analyzer
├── msaf/               # MSAF fallback analyzer
└── document-mcp/       # Document search MCP (TEACHER knowledge base)
agents/                 # Agent implementations
└── teacher/            # Teacher agent (Python)
data/                   # Runtime data & knowledge
├── teacher-state/      # Teacher progress tracking
├── reference-docs/     # Sound design conversations
└── manuals/            # Reference PDFs (Ableton, plugins)
io/                     # I/O services
├── tts/                # Text-to-speech
└── voice/              # Voice input (Whisper.cpp)
docs/                   # Documentation
JUCE/                   # UI framework (git submodule)
whisper.cpp/            # Speech recognition
lib/                    # Pre-built whisper.cpp binaries
```

---

## Technical Reference

### Quick Start

**Build:**
```bash
cd /Users/mk/c/ClaudeVST
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh  # IMPORTANT: Adds permissions, re-signs
```

**Load in Ableton:**
1. Rescan plugins in Ableton (Preferences -> Plug-Ins -> Rescan)
2. Find "ClaudeVST_MMDD_HHMM" in plugin browser (timestamped name)
3. Add to any audio track

**Respond to Messages:**
When user sends a message from VST, it appears in `messages/to_claude.json`:
```json
{
  "timestamp": 1768571646797,
  "message": "How does my mix sound?",
  "audio_context": "=== AUDIO ANALYSIS ===\nRMS Level: L=-14.2dB..."
}
```

Read it, formulate response, write to `messages/from_claude.json`:
```json
{
  "timestamp": 1768571700000,
  "response": "Your mix sounds good! The spectrum shows..."
}
```

The VST polls this file and displays your response.

### File-Based Communication

```
User (Ableton) <-> VST <-> messages/*.json <-> Claude Code (Terminal)
```

| File | Direction | Purpose |
|------|-----------|---------|
| `messages/to_claude.json` | VST -> Claude | User messages with audio context |
| `messages/from_claude.json` | Claude -> VST | Claude's responses |
| `messages/audio_analysis.json` | VST -> Claude | Real-time audio data (2Hz) |

**Why File-Based?**
- User has Claude subscription (Claude Code), doesn't want API costs
- Claude Code can't receive push messages, but can read files
- Simple, reliable, no network complexity

**Why Timestamped Plugin Names?**
Ableton caches plugins aggressively. Changing the name (e.g., `ClaudeVST_0116_1547`) forces Ableton to load the new version without restarting.

### Audio Analysis Data

The VST writes real-time audio analysis to `messages/audio_analysis.json`:

```json
{
  "timestamp": 1768571550805,
  "levels": {
    "rms_left_db": -14.75,
    "rms_right_db": -14.86,
    "peak_left_db": -8.41,
    "peak_right_db": -8.59,
    "crest_factor_db": 6.30
  },
  "spectrum": {
    "sub_db": 30.99,
    "bass_db": 34.84,
    "low_mid_db": 32.19,
    "mid_db": 25.28,
    "upper_mid_db": 21.61,
    "presence_db": 15.73,
    "brilliance_db": 7.42,
    "air_db": -10.33
  }
}
```

**Spectrum Bands:**
- sub: 20-60 Hz
- bass: 60-250 Hz
- low_mid: 250-500 Hz
- mid: 500-2000 Hz
- upper_mid: 2000-4000 Hz
- presence: 4000-6000 Hz
- brilliance: 6000-12000 Hz
- air: 12000-20000 Hz

**Interpreting Audio Data:**

*RMS Levels (average loudness):*
- -18 to -12 dB: Good mixing level
- Above -6 dB: Very loud, possibly clipping
- Below -30 dB: Very quiet

*Peak Levels (transient peaks):*
- Should stay below 0 dB to avoid clipping
- Healthy headroom: peaks around -6 to -3 dB

*Crest Factor (peak - RMS, indicates dynamics):*
- 3-6 dB: Heavily compressed (electronic, loud rock)
- 8-12 dB: Moderate dynamics (pop, most music)
- 14+ dB: Very dynamic (classical, jazz)

*Spectrum (frequency balance):*
- Electronic/Bass music: Strong sub/bass (30+ dB)
- Speech: Sub/bass from fundamental, rolling off in highs
- Balanced mix: Relatively even across bands, slight tilt toward bass

### Voice Features

**Voice Input (Whisper.cpp):**
- Hold the **[Mic]** button in the VST to speak
- Uses **whisper.cpp** (not macOS Speech) - no TCC permissions needed
- Whisper model: `whisper.cpp/models/ggml-tiny.bin` (~75MB)
- Audio captured from VST input, resampled to 16kHz, transcribed locally
- Works with monitoring "In" - VST doesn't pass through input audio

**Voice Output (Text-to-Speech):**
- Currently: beep notification when response arrives
- Goal: Full TTS through VST output using AVSpeechSynthesizer
- Challenge: Thread safety between TTS generation thread and audio thread

**Audio Thread Architecture:**
```
processBlock() runs on AUDIO THREAD (real-time, can't block)
UI callbacks run on MESSAGE THREAD (can block)

Solution: Use atomic flags to communicate between threads
- UI sets flag: beepRequested.store(true)
- Audio thread checks: if (beepRequested.load()) generate audio
```

### Source Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `PluginProcessor.cpp/h` | ~150 | Audio callback, hosts analyzer + TTS |
| `PluginEditor.cpp/h` | ~220 | Chat UI, voice button, level display |
| `ClaudeClient.cpp/h` | ~120 | File I/O for messages |
| `AudioAnalyzer.cpp/h` | ~150 | FFT spectrum, RMS/peak |
| `OSCClient.cpp/h` | ~100 | AbletonOSC communication |
| `SpeechRecognizer.mm/h` | ~130 | macOS speech-to-text |
| `SpeechSynthesizer.mm/h` | ~180 | macOS text-to-speech through VST |

### Message Handling Best Practices

When responding to VST messages:

1. **Read the audio context** - It's included in every message
2. **Be specific** - Reference actual dB values, frequency bands
3. **Be concise** - Long responses take time to speak via TTS
4. **Acknowledge the audio** - "I can hear your mix..." builds trust

Example good response:
```
Your mix is hitting -14 dB RMS with peaks around -6 dB - good headroom!
The spectrum shows strong bass (35dB) which is typical for electronic music.
The crest factor of 6dB suggests moderate compression.
```

### Coaching Response Pattern

Good coaching follows this pattern:

1. **Acknowledge the symptom** - "I hear that your kick sounds muddy..."
2. **Identify likely causes** - "This usually happens because..."
3. **Give specific fixes** - "Set EQ Eight high-pass to 50 Hz on the rumble track"
4. **Explain why** - "This works because kick and rumble compete for sub frequencies"

### Token Efficiency

**DO NOT:**
- Query full browser tree (returns 131k chars)
- Repeatedly poll session info (use delta tools)

**DO:**
- Use `get_session_delta` instead of `get_session_info`
- Use `get_parameter_by_name` instead of fetching all params

### Development Workflow

**Making Changes:**
1. Edit source files in `src/`
2. Build: `cmake --build build`
3. Fix permissions: `./scripts/post_build.sh`
4. In Ableton: Remove old plugin, add new one (look for new timestamp)

**Debugging Crashes:**
```bash
ls -lt ~/Library/Logs/DiagnosticReports/ | head -5
grep "termination\|exception" ~/Library/Logs/DiagnosticReports/Live-*.ips | head -10
```

Common issues:
- Missing plist permissions -> Run post_build.sh
- Speech recognition crash -> NSSpeechRecognitionUsageDescription missing

**Clean Build:**
```bash
rm -rf build
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh
```

### Known Issues

1. **Permissions must be added post-build** - JUCE's PLIST_TO_MERGE doesn't fully work for all keys
2. **Ableton caches plugins** - Solved with timestamped names
3. **TTS sample rate conversion** - Simple linear interpolation, could be improved
4. **No streaming responses** - Full response must complete before display/speech

### Git Commits

When committing changes:
```bash
git add -A
git commit -m "Description of changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## See Also

### Core Documentation
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Comprehensive technical overview of all components and knowledge base
- **[docs/SYSTEM.md](docs/SYSTEM.md)** - Setup checklist, running services, and troubleshooting
- **[docs/MESSAGES.md](docs/MESSAGES.md)** - JSON message format specification for all communication files

### Component-Specific Guides
- **[docs/VST.md](docs/VST.md)** - Plugin build process, threading model, and source file overview
- **[docs/ABLETONOSC.md](docs/ABLETONOSC.md)** - AbletonOSC installation, commands, and action execution
- **[docs/WHISPER.md](docs/WHISPER.md)** - Voice recognition setup, model options, and integration details
- **[docs/TTS.md](docs/TTS.md)** - Text-to-speech services (both VST-embedded and standalone)

### Quick Links by Task
- **First-time setup?** -> [docs/SYSTEM.md](docs/SYSTEM.md) - Setup Checklist
- **Build not working?** -> [docs/VST.md](docs/VST.md) - Build Instructions & Debugging
- **Need message format?** -> [docs/MESSAGES.md](docs/MESSAGES.md) - Schema & Examples
- **OSC commands?** -> [docs/ABLETONOSC.md](docs/ABLETONOSC.md) - Available Commands
- **Voice issues?** -> [docs/WHISPER.md](docs/WHISPER.md) - Troubleshooting

---

*Last updated: January 21, 2026*

### CRUCIAL YOU MUST HAVE RE-READ THIS ENTIRE DOCUMENT IN FULL ONCE YOU COMPLETED THE LAST TASK.