# ClaudeVST Multi-Agent System

This document describes the multi-agent architecture for ClaudeVST, a continuous learning music production system with an always-available AI teacher and active development loop with specialized development agents.

---

## System Overview

ClaudeVST operates as a multi-agent system with **six primary agents**:

1. **Master Agent** (Development Coordinator & Ralph Manager)
2. **Teacher Agent** (Always-Available Music Tutor)
3. **Ralph-VST** (C++/JUCE Plugin Development)
4. **Ralph-MCP** (Ableton Control - MCP + OSC Unified)
5. **Ralph-Whisper** (Voice Recognition Service)
6. **Ralph-TTS** (Text-to-Speech Service)

Plus supporting services:
- TTS Watcher (Text-to-Speech standalone)
- MCP Extended Server (Ableton control via UDP + TCP)
- Document Indexer (Semantic search across 100KB+ docs via Ollama)

---

## Agent Roles

### Master Agent (You - Ralph Coordinator)
- **Interface:** Claude Code Terminal (primary)
- **Availability:** On-demand (not aggressively available)
- **Responsibilities:**
  - System architecture and coordination
  - **Assign tasks to specialized Ralph agents**
  - Review Ralph reports and ensure interoperability
  - Commit preparation and approval
  - User brainstorming and strategic planning

**Files:**
- Instructions: `agents/master_agent.md`
- Input: Terminal + `messages/to_master.json` (M: prefix)
- Output: Terminal + `messages/from_claude.json`

### Teacher Agent
- **Interface:** VST (text & voice)
- **Availability:** AGGRESSIVELY AVAILABLE (always responsive)
- **Responsibilities:**
  - Music production tutoring (hypnotic techno/BCCO style)
  - Real-time audio analysis feedback
  - **Ableton control via MCP Extended (create clips, load Serum by path, import audio, batch ops)**
  - **UDP real-time parameter control** (ultra-low latency for demonstrations)
  - **OSC for ecosystem** (OPTIONAL - Max/MSP, hardware)
  - Student progress tracking
  - Theory, sound design, mixing, mastering guidance

**Files:**
- Instructions: `agents/teacher_agent.md`
- Refinements: `teacher/instructions_refinements.md`
- Memory: `teacher/student_progress.json`
- Input: `messages/to_claude.json` (VST messages, NOT M: prefix)
- Output: `messages/from_teacher.json`

### Ralph-VST (Plugin Development Specialist)
- **Interface:** Ralph Loop (5-30 cycles per task)
- **Specialty:** C++, JUCE, Audio DSP
- **Responsibilities:**
  - VST plugin core development
  - UI (chat, voice button, meters)
  - Audio analysis (FFT, RMS, LUFS)
  - Integration with other subsystems

**Files:**
- Instructions: `agents/ralph_vst.md`
- Code: `src/*.cpp/h`, `CMakeLists.txt`
- Backlog Tag: `[VST:N]`

### Ralph-MCP (Ableton Control Specialist)
- **Interface:** Ralph Loop (5-30 cycles per task)
- **Specialty:** Python, Ableton Remote Scripts, MCP Protocol, OSC (optional)
- **Responsibilities:**
  - **Integrate Ableton MCP Extended** (github.com/uisato/ableton-mcp-extended)
    - UDP hybrid server (ultra-low latency real-time control)
    - Browser URIs (load Serum presets by path!)
    - Audio import (reference tracks)
    - Batch operations (multi-track changes)
    - Parameter reading (get_device_parameters)
  - **Add OSC protocol support** (OPTIONAL - only for Max/MSP, hardware)
  - Create Teacher-friendly API
  - Genre-aware pattern generators

**Files:**
- Instructions: `agents/ralph_mcp.md`
- Code: `companions/mcp/`
- Backlog Tag: `[MCP:N]`

### Ralph-Whisper (Voice Recognition Specialist)
- **Interface:** Ralph Loop (5-20 cycles per task)
- **Specialty:** Whisper.cpp, Audio Processing, C++
- **Responsibilities:**
  - Whisper.cpp integration and optimization
  - Model management (tiny/medium/etc.)
  - VST integration (SpeechRecognizer)
  - Accuracy vs performance tuning

**Files:**
- Instructions: `agents/ralph_whisper.md`
- Code: `src/SpeechRecognizer.*`, `whisper.cpp/`, `lib/`
- Backlog Tag: `[WHISPER:N]`

### Ralph-TTS (Text-to-Speech Specialist)
- **Interface:** Ralph Loop (5-20 cycles per task)
- **Specialty:** macOS TTS, Python Services, Audio Generation
- **Responsibilities:**
  - TTS watcher service (standalone)
  - VST-embedded TTS (future)
  - Voice quality and selection
  - SSML support for emphasis

**Files:**
- Instructions: `agents/ralph_tts.md`
- Code: `companions/tts/`, `src/SpeechSynthesizer.*`
- Backlog Tag: `[TTS:N]`

---

## Communication Flow

### User → Teacher (VST)
```
User types/speaks in VST
  ↓
messages/to_claude.json (written by VST)
  ↓
Teacher Agent reads and responds
  ↓
messages/from_teacher.json (written by Teacher)
  ↓
VST displays and speaks response
```

### User → Master (Terminal)
```
User types in Claude Code terminal
  ↓
Master Agent responds directly
  ↓
Terminal output

OR (for M: prefixed VST messages)

User types "M: message" in VST
  ↓
messages/to_master.json
  ↓
Master Agent reads and responds
  ↓
messages/from_claude.json
```

### Master → Specialized Ralphs (Development)
```
Master assigns task from backlog to appropriate Ralph
  ↓
Ralph-[VST|MCP|Whisper|TTS] executes N-cycle iteration
  ↓
Ralph generates report in development/reports/
  ↓
Master reviews for interoperability
  ↓
If multiple Ralphs involved, Master coordinates integration
  ↓
Master prepares commit (combining all changes)
  ↓
User approves commit
```

---

## File Structure

```
/Users/mk/c/ClaudeVST/
├── agents/                        # Agent instruction files
│   ├── master_agent.md           # Master agent instructions
│   ├── teacher_agent.md          # Teacher agent instructions
│   ├── ralph_vst.md              # Ralph-VST (plugin development)
│   ├── ralph_mcp.md              # Ralph-MCP (Ableton MCP Extended + OSC)
│   ├── ralph_whisper.md          # Ralph-Whisper (voice recognition)
│   └── ralph_tts.md              # Ralph-TTS (text-to-speech)
│
├── messages/                      # Inter-agent communication
│   ├── to_claude.json            # VST → Teacher (non M:)
│   ├── from_teacher.json         # Teacher → VST
│   ├── to_master.json            # VST → Master (M: prefix)
│   ├── from_claude.json          # Master → VST
│   └── audio_analysis.json       # Real-time audio data
│
├── teacher/                       # Teacher agent data
│   ├── student_progress.json     # Learning progress tracking
│   └── instructions_refinements.md # Behavioral refinements
│
├── development/                   # Development workflow
│   ├── backlog.md                # Task backlog for Ralph
│   └── reports/                  # Ralph's cycle reports
│
├── services/                      # Service PID tracking
│   ├── teacher.pid               # Teacher service
│   ├── master.pid                # Master service
│   ├── ralph.pid                 # Ralph service
│   ├── tts_watcher.pid           # TTS service
│   └── README.md
│
├── hooks/                         # System control hooks
│   ├── start_all.sh              # Start all services
│   ├── stop_all.sh               # Stop all services
│   ├── restart_all.sh            # Restart all services
│   └── master_hook.sh            # Master control interface
│
└── scripts/
    ├── build_and_deploy.sh        # A/B deployment for VST
    └── post_build.sh              # Permissions and signing
```

---

## Starting the System

### 1. Start Support Services
```bash
cd /Users/mk/c/ClaudeVST
./hooks/start_all.sh
```

This starts:
- TTS watcher (for speaking responses)
- (Future: OSC monitor)

### 2. Start Teacher Agent
In a separate terminal:
```bash
# TODO: Exact command TBD when agent sessions are implemented
# Expected: claude --agent agents/teacher_agent.md
```

### 3. Master Agent Already Running
You are the Master agent, running in your primary Claude Code terminal.

### 4. Load VST in Ableton
- Rescan plugins if new build
- Add ClaudeVST to any track
- Set monitoring to "In" for voice input

---

## Stopping the System

Use the master hook:
```bash
./hooks/master_hook.sh stop
```

Or manually:
```bash
./hooks/stop_all.sh
```

---

## Development Workflow

### Adding New Features

1. **User brainstorms with Master** (in terminal)
2. **Master adds task to backlog** (`development/backlog.md`)
3. **Master triggers Ralph cycle** (optional, or Ralph picks up automatically)
4. **Ralph implements over 20 iterations**
5. **Ralph generates report** (`development/reports/`)
6. **Ralph prepares commit** (staged, not pushed)
7. **Master reviews report and commit**
8. **Master asks user for approval**
9. **User approves, Master pushes commit**

### A/B VST Deployment

When Ralph or Master makes VST changes:

```bash
./scripts/build_and_deploy.sh
```

This:
1. Builds new timestamped VST (e.g., `ClaudeVST_0116_2045.vst3`)
2. Deploys alongside existing version
3. User continues using old version
4. User switches by removing old, adding new in Ableton
5. Development can continue on inactive version

---

## Core Principles

### 1. Append-Only Core Files
Unless explicitly instructed, these files are append-only:
- `agents/*.md` (agent instructions)
- `development/backlog.md` (tasks accumulate)
- `teacher/student_progress.json` (progress accumulates)
- `teacher/instructions_refinements.md` (refinements accumulate)

This allows knowledge to build up over time.

### 2. Service Auto-Restart
All services auto-restart on failure:
- Crash logged
- 5-second delay
- Service restarted
- PID file updated
- Master notified

Intentional stops (via hooks) remove PID file to prevent restart.

### 3. No Unilateral Commits
Ralph prepares commits but never pushes. Master reviews and user approves.

### 4. Teacher Always Available
Teacher responds to EVERY VST message (except M: prefix) immediately.
Master only responds when user engages directly.

### 5. Active Development During Use
System is designed to be improved WHILE BEING USED:
- A/B deployment for hot-swapping
- Ralph works on inactive version
- Services can be updated and restarted
- Knowledge files accumulate learnings

---

## Immediate Next Steps

As defined in `development/backlog.md`:

### HIGH PRIORITY (CRITICAL PATH!)
1. **[MCP:25] Integrate Ableton MCP Extended** (CRITICAL - enables Teacher to create/demonstrate!)
   - Ralph-MCP: Install Remote Script from github.com/uisato/ableton-mcp-extended
   - Set up UDP hybrid server for ultra-low latency
   - Test browser integration (load Serum presets by path)
   - Test audio import (reference tracks)
   - Verify parameter reading (get_device_parameters)

2. **[ALL:10] Set up document-mcp indexing** (CRITICAL - semantic doc search)
   - Clone github.com/yairwein/document-mcp
   - Install Ollama for local embeddings (privacy + no API costs)
   - Configure to index: agents/, docs/, development/, external docs
   - Test semantic search capabilities

3. **[MCP:15] Build Teacher API for MCP Extended** (HIGH - enables teaching demos)
   - Create high-level methods for Teacher
   - Genre-aware helpers (hypnotic techno patterns)
   - Batch operation wrappers

4. **[WHISPER:15] Upgrade to medium model** (HIGH - better transcription)
   - Ralph-Whisper: Download ggml-medium.bin, test accuracy

5. **[VST:8] Route Teacher vs Master messages** (HIGH - enable multi-agent)
   - Ralph-VST: Update ClaudeClient for dual-channel

### OPTIONAL (Low Priority)
6. **[MCP:15] Add OSC protocol support** (OPTIONAL - only for Max/MSP, hardware)
   - MCP Extended covers ALL Ableton needs
   - OSC only useful for ecosystem integration

### Implementation Strategy
- **Master assigns tasks** to appropriate Ralph based on [TAG:N]
- **Ralphs work independently** but coordinate via interfaces.md
- **Master ensures interoperability** before preparing commits
- **User approves** final integrated commits

---

## Usage Patterns

### For Music Production Learning
- **Load VST in Ableton**
- **Teacher is always available via text or voice**
- **Ask questions, get feedback, request demonstrations**
- **Teacher uses OSC to control Ableton for teaching**
- **Progress is tracked automatically**

### For Development Tasks
- **User discusses with Master in terminal**
- **Master delegates to Ralph via backlog**
- **Ralph implements, reports, prepares commit**
- **Master reviews with user**
- **User approves final commits**

### For System Control
```bash
./hooks/master_hook.sh status    # Check all services
./hooks/master_hook.sh stop      # Stop everything
./hooks/master_hook.sh start     # Start everything
./hooks/master_hook.sh build     # Build and deploy VST
```

---

## Teaching Philosophy

Teacher specializes in:
- **Hypnotic Techno** production (BCCO Records aesthetic)
- **Hands-on, practical guidance** over pure theory
- **Real-time audio analysis feedback**
- **Progressive skill building** with tracked milestones
- **Ableton control demonstrations** via OSC
- **Encouraging experimentation** and creativity

---

## Future Enhancements

- Advanced OSC endpoints (devices, clips, scenes)
- LUFS metering for mastering guidance
- Reference track analysis and comparison
- Transient detection for rhythm analysis
- Spectrum visualization in VST
- MIDI CC learning for parameter control
- Session state persistence
- Advanced sidechain analyzer

See `development/backlog.md` for complete roadmap.

---

*Last updated: 2026-01-16*
