# ClaudeVST Development Backlog

**Last Updated:** 2026-01-16
**Managed By:** Master Agent (reviewed with user)
**Executed By:** Ralph Agent (20-cycle iterations)

---

## Task Status Legend
- `[ ]` - Not started
- `[IN PROGRESS]` - Currently being worked on
- `[DONE]` - Completed and tested
- `[BLOCKED]` - Waiting on dependency or decision

## Task Tagging System
Each task is tagged with the responsible Ralph agent and cycle count:
- `[VST:N]` - Ralph-VST (plugin development) - N iterations
- `[MCP:N]` - Ralph-MCP (Ableton control, MCP+OSC) - N iterations
- `[WHISPER:N]` - Ralph-Whisper (voice recognition) - N iterations
- `[TTS:N]` - Ralph-TTS (text-to-speech) - N iterations

**Cycle count guidelines:**
- Small tasks (single function, minor change): 5-10 cycles
- Medium tasks (new feature, module refactor): 10-20 cycles
- Large tasks (system integration, major feature): 20-40 cycles

Master Agent assigns tasks to appropriate Ralph based on tag.

---

## HIGH PRIORITY

### MCP Integration (NEW! - CRITICAL PATH)
- [DONE] [MCP:25] Integrate Ableton MCP Extended from github.com/uisato/ableton-mcp-extended
  - **Why Extended:** UDP low-latency, browser URIs (Serum presets!), audio import, batch ops
  - ✓ Install Remote Script in Ableton
  - ✓ Set up UDP hybrid server for real-time control
  - ✓ Test browser integration: load Serum preset by path
  - Test audio import: reference tracks (not yet tested)
  - ✓ Test batch operations: multi-track changes
  - **Completed:** 2026-01-17 - MCP server running, session/track/clip control working

- [DONE] [MCP:15] Build Teacher API for Ableton MCP Extended
  - ✓ High-level methods: create_bassline(), load_serum(), import_reference()
  - ✓ Genre-aware helpers (hypnotic techno patterns)
  - ✓ Batch operation wrappers
  - ✓ Browser navigation helpers
  - **Completed:** 2026-01-17 - companions/teacher_mcp_api.py created

- [DONE] [MCP:10] Implement parameter reading capabilities
  - ✓ Added get_device_parameters() to Remote Script and MCP server
  - ✓ Added set_device_parameter() for writing parameters
  - ✓ Research documented in docs/PARAMETER_READING_RESEARCH.md
  - Needs: Restart Ableton to test with real devices
  - **Completed:** 2026-01-17 - Implementation complete, awaiting Ableton reload

### Documentation & Knowledge (NEW!)
- [DONE] [ALL:10] Set up document-mcp indexing server
  - ✓ Configured and running as MCP server (claudevst-docs)
  - ✓ 21 documents indexed (19 markdown + 2 PDFs)
  - ✓ 24,683 chunks with 416K tokens indexed
  - ✓ Semantic search working via get_catalog, search_documents tools
  - **Completed:** 2026-01-17 - Already operational, 84.79 MB indexed

### Audio & Voice
- [ ] [WHISPER:15] Replace Whisper tiny model with medium model
  - Download ggml-medium.bin (1.5GB)
  - Update CMakeLists.txt model path
  - Test accuracy on music production terms
  - Document speed vs accuracy tradeoff
  - **Rationale:** Better transcription of technical terms
  - **Impact:** HIGH - core voice interaction quality

- [ ] [WHISPER:12] Implement voice activity detection (VAD)
  - Auto-start recording on speech detected
  - Auto-stop on silence
  - Reduce need to hold button
  - **Rationale:** More natural voice interaction
  - **Impact:** MEDIUM - UX improvement

### VST Plugin
- [ ] [VST:10] Add MCP connection status indicator to UI
  - Poll MCP server health
  - Visual indicator: ✓ connected / ✗ disconnected
  - Show in status bar
  - **Rationale:** User needs to know if Teacher can control Ableton
  - **Impact:** MEDIUM - visibility and confidence

- [ ] [VST:8] Update ClaudeClient to route Teacher vs Master messages
  - Teacher → from_teacher.json
  - Master → from_claude.json
  - Parse M: prefix for Master
  - **Rationale:** Separate communication channels
  - **Impact:** HIGH - enables multi-agent architecture

### Multi-Agent Infrastructure
- [DONE] Create specialized Ralph agent instruction files
- [DONE] Create communication file structure
- [DONE] Create development backlog with tagging
- [DONE] Create hook system (start_all, stop_all, restart_all)
- [DONE] Build A/B deployment script for VST
- [ ] [VST:5] Implement service management with PID tracking in VST UI

---

## MEDIUM PRIORITY

### Audio Analysis Enhancement
- [ ] [VST:15] Add LUFS metering (integrated loudness)
  - Implement EBU R128 algorithm in AudioAnalyzer
  - Replace simple RMS with LUFS
  - Display in UI and send to Teacher
  - **Impact:** MEDIUM - better mastering guidance

- [ ] [VST:20] Implement transient detection for rhythm analysis
  - Detect kick/snare hits, analyze groove
  - Feed timing data to Teacher
  - Teacher can comment on rhythm tightness
  - **Impact:** MEDIUM - enriches Teacher's feedback

- [ ] [VST:12] Add spectrum visualization component
  - Real-time FFT display in UI
  - Visual feedback during mixing
  - Color-code frequency ranges
  - **Impact:** LOW - nice visual, not critical

### Teacher & MCP Capabilities
- [ ] [MCP:10] Add genre-specific pattern generators
  - create_hypnotic_bassline()
  - create_techno_kick_pattern()
  - create_rolling_hihat()
  - **Impact:** HIGH - powerful teaching demonstrations

- [ ] [MCP:15] Implement reference track analysis
  - Load reference track into Ableton via MCP
  - Analyze spectrum, dynamics, structure
  - Teacher compares to user's mix
  - **Impact:** HIGH - powerful learning tool

### TTS Improvements
- [ ] [TTS:10] Implement SSML support for emphasis
  - Parse <emphasis> and <break> tags
  - Improve teaching clarity
  - Document SSML guide for Teacher
  - **Impact:** MEDIUM - better voice quality

- [ ] [TTS:15] Complete VST-embedded TTS (replace beep)
  - Fix thread safety in SpeechSynthesizer
  - Lock-free queue between TTS and audio thread
  - Remove beep fallback
  - **Impact:** MEDIUM - cleaner UX

---

## LOW PRIORITY

### OSC Integration (OPTIONAL - Ecosystem Only)
- [ ] [MCP:15] Add OSC protocol support (ONLY if needed for Max/hardware)
  - MCP Extended covers ALL Ableton control needs
  - OSC only useful for:
    - Max/MSP integration (advanced sound design teaching)
    - Hardware controllers (TouchOSC, etc.)
    - Other DAWs (Bitwig, Reaper)
  - **Rationale:** Nice-to-have for ecosystem, but MCP Extended is superior for Ableton
  - **Impact:** LOW - optional extension, not core functionality

### Advanced Features
- [ ] [VST:12] Session state persistence
  - Remember conversation history across loads
  - Restore Teacher's context
  - Save/load student progress
  - **Impact:** LOW - convenience feature

- [ ] [MCP:20] MIDI CC learning for parameter control
  - Map MIDI controls to Ableton parameters
  - Integrate with MCP/OSC
  - **Impact:** LOW - advanced use case

- [ ] [MCP:30] Local LLM fallback option (Ollama)
  - Quick queries without Claude Code
  - Free, always available
  - Integrate with Teacher agent
  - **Impact:** LOW - Claude Code is preferred

### UI Improvements
- [ ] [VST:5] Dark mode theme
  - Better aesthetics for studio use
  - Less eye strain
  - **Impact:** LOW - cosmetic

- [ ] [VST:10] Resizable VST window
  - User can adjust chat window size
  - Save window size preference
  - **Impact:** LOW - convenience

### Advanced Audio
- [ ] [VST:25] Advanced sidechain analyzer
  - Visualize sidechain pumping effect
  - Analyze attack/release timing
  - Suggest optimal settings
  - **Impact:** LOW - niche feature

- [ ] [VST:15] Stereo width analyzer
  - Correlation meter
  - Stereo field visualization
  - Mid/side analysis
  - **Impact:** LOW - useful but not critical

---

## BACKLOG MAINTENANCE

### Adding Tasks
When adding tasks, include:
- Clear description
- Rationale (why it matters)
- Effort estimate (Small/Medium/Large)
- Impact rating (Low/Medium/High/Critical)

### Prioritization Guidelines
- **HIGH:** Core functionality, Teacher capabilities, critical bugs
- **MEDIUM:** Enhanced features, quality improvements, nice-to-haves
- **LOW:** Advanced features, experimental ideas, cosmetic changes

### Task Lifecycle
1. Task added to appropriate priority section
2. Ralph picks highest priority `[ ]` task
3. Task marked `[IN PROGRESS]` during cycle
4. Task marked `[DONE]` when complete, tested, documented
5. Task moves to archive (or stays for reference)

---

## COMPLETED TASKS ARCHIVE

### 2026-01-16
- [DONE] Create comprehensive documentation system
  - docs/SYSTEM.md, MESSAGES.md, VST.md, etc.
  - Complete architecture documentation
  - **Completed by:** Master agent

- [DONE] Set up multi-agent workflow infrastructure
  - Agent instruction files created
  - Communication file structure
  - Development backlog system
  - **Completed by:** Master agent

---

## NOTES

### Future Considerations
- Integration with hardware controllers (Push, Launchpad)
- Cloud-based session backup/collaboration
- Plugin preset management system
- Advanced arrangement analysis (song structure detection)

### Known Limitations
- VST currently requires manual plugin switching for A/B deployment
- No unit test framework yet (all testing is manual)
- TTS embedded in VST still work in progress (use standalone watcher)
- Whisper tiny model occasionally has transcription errors

---

*This backlog is a living document. Tasks are continuously added, reprioritized, and completed as the system evolves.*
