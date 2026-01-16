# Ralph Agent Effectiveness Guide

**Purpose:** Ensure Ralph agents (specialized developers) work effectively and deliver high-quality results.

**Audience:** Master Agent, User

---

## The Ralph Agent Model

Ralph agents are **cycle-based specialists** (5-30 iterations per task) who:
- Focus deeply on one technical domain (VST, MCP, Whisper, TTS)
- Work autonomously within their scope
- Report results with interoperability notes
- Coordinate through Master for integration

**Not general assistants** - they're domain experts with specific responsibilities.

---

## Core Principles for Ralph Effectiveness

### 1. **Well-Scoped Tasks** (CRITICAL)

Ralph agents thrive on clear, bounded tasks.

**✅ Good Task (from backlog):**
```markdown
- [VST:10] Add MCP connection status indicator to UI
  - Poll MCP server health every 2 seconds
  - Visual indicator: ✓ (green) or ✗ (red)
  - Show in status bar
  - **Rationale:** User needs to know if Teacher can control Ableton
  - **Impact:** MEDIUM - visibility and confidence
  - **Done When:** Indicator updates correctly, no audio thread blocking
```

**❌ Bad Task:**
```markdown
- [VST:??] Make the plugin better
```

**Why good tasks work:**
- Clear deliverable (status indicator)
- Specific implementation details (poll every 2s, colors)
- Defined success criteria (updates correctly, thread-safe)
- Impact/rationale explains why it matters
- Cycle estimate sets expectations

### 2. **Defined "Done" Criteria**

Every task must answer: "How do I know I'm finished?"

**Done Checklist Template:**
```markdown
## Task Complete When:
- [ ] Implementation matches specification
- [ ] Manual testing passed in Ableton (or relevant environment)
- [ ] No audio thread violations (for VST tasks)
- [ ] Documentation updated (code comments, relevant .md files)
- [ ] Report generated with interoperability notes
- [ ] Interfaces documented in development/interfaces.md
```

**Ralph should self-assess** before marking [DONE].

### 3. **Clear Interface Contracts**

Ralph agents must know **exactly** what other agents expect from them.

**Example:** Ralph-VST depends on Ralph-Whisper's SpeechRecognizer

```cpp
// development/interfaces.md documents:
class SpeechRecognizer {
    // MUST be lock-free (audio thread calls this)
    void processAudioInput(const float* samples, int numSamples);
};
```

**Ralph-Whisper's responsibility:**
- Implement processAudioInput() lock-free
- Test with audio thread profiling
- Document any constraints in code comments
- Note in report if interface changes

**Ralph-VST's responsibility:**
- Call only from audio thread
- Handle callback on message thread
- Check hasPermission() before use

**Master's role:**
- Review both sides of interface
- Ensure contract is met
- Mediate if changes needed

### 4. **Autonomous Testing**

Ralph must test their own work before reporting.

**Testing Requirements by Domain:**

#### Ralph-VST
- [ ] Load plugin in Ableton
- [ ] Test with real audio input/output
- [ ] Verify UI updates correctly
- [ ] Check audio thread profiling (no xruns)
- [ ] Test voice button with actual speech
- [ ] Remove old plugin, add new (A/B deployment)

#### Ralph-MCP
- [ ] Ableton Live running with Remote Script
- [ ] Test clip creation, instrument loading
- [ ] Verify parameter reading works
- [ ] Test error handling (Ableton closed, etc.)
- [ ] Check Teacher API methods work end-to-end

#### Ralph-Whisper
- [ ] Transcription accuracy on 20+ test phrases
- [ ] Music production terms correct (sidechain, ADSR, etc.)
- [ ] Measure transcription latency
- [ ] Verify GPU acceleration working
- [ ] Test various sample rates (44.1k, 48k, 96k)

#### Ralph-TTS
- [ ] Voice quality assessment (clarity, naturalness)
- [ ] Speech rate appropriate for technical content
- [ ] SSML tags work if implemented
- [ ] Latency from message to speech < 500ms
- [ ] Service runs 24+ hours without crashes

**Rule:** If Ralph can't test it, task scope is too large. Break it down.

### 5. **Interoperability Reporting**

Every Ralph report must include: "What do other agents need to know?"

**Report Template:**
```markdown
# Ralph-[DOMAIN] Report
**Date:** YYYY-MM-DD HH:MM
**Cycles:** N
**Task:** [TAG:N] Task description

## Changes
- File-level summary of what changed
- New features/functions added
- Bugs fixed

## Testing
- ✅ Test 1 passed
- ✅ Test 2 passed
- ⚠️  Test 3 has known limitation (explain)

## Interfaces Affected
**Changes to development/interfaces.md:**
- Updated SpeechRecognizer API (added language param)

**New dependencies:**
- Ralph-VST must rebuild with new model path

**Coordination needed:**
- Ralph-MCP should expose status endpoint (propose: GET /status)

## Performance Impact
- Transcription time: 1s → 5s (acceptable tradeoff for accuracy)
- Memory usage: +200MB (loaded larger model)
- CPU: No change

## Known Issues
- Model path hardcoded in CMakeLists.txt (future: make configurable)
- Doesn't handle unsupported audio formats (future: add validation)

## Next Recommended Tasks
- [WHISPER:12] Implement voice activity detection
- [WHISPER:8] Add noise gate preprocessing

---
@Master: Ready for review. Interfaces documented. No breaking changes to other Ralphs.
```

**Key sections:**
- **Changes:** What was done
- **Testing:** Proof it works
- **Interfaces Affected:** What other Ralphs need to know
- **Performance Impact:** Any speed/memory changes
- **Known Issues:** Honest about limitations
- **@Master:** Explicit handoff

### 6. **Cycle Discipline**

Ralph estimates cycles upfront and sticks to them.

**Cycle Budget:**
- Small tasks: 5-10 cycles
- Medium tasks: 10-20 cycles
- Large tasks: 20-40 cycles

**If running over:**
- Stop at cycle limit
- Report partial progress
- Explain why estimate was off
- Recommend: split into smaller tasks OR increase estimate

**Example:**
```markdown
@Master: Reached cycle 20/20 for [MCP:20] task.

Progress: 80% complete (clip creation works, instrument loading works,
parameter control has edge cases).

Issue: Device parameter API more complex than expected (100+ parameters
per device, need caching strategy).

Recommend: Mark current work DONE, open new task [MCP:10] for parameter
caching optimization.
```

**Why this matters:**
- Prevents infinite loops ("just one more thing...")
- Forces task breakdown when scope creeps
- Gives Master predictable work units
- Enables parallel Ralph workflows

### 7. **Specialization Boundaries**

Ralph agents must **stay in their lane** and delegate correctly.

**Ralph-VST's Lane:**
- C++/JUCE code in src/
- CMakeLists.txt
- UI components
- Audio thread logic

**NOT Ralph-VST's Lane:**
- Teacher's pedagogical strategy → Teacher agent
- MCP server implementation → Ralph-MCP
- Whisper model selection → Ralph-Whisper

**If Ralph discovers work outside their lane:**
```markdown
## Additional Tasks Discovered

While implementing [VST:10], I noticed:
- MCP status endpoint doesn't exist yet (needed for this task)
- Recommend: [MCP:5] Add GET /status endpoint returning connection state

@Ralph-MCP: Can you implement this? I need it for VST UI indicator.

I've stubbed the VST code to use services/mcp_status.json as fallback.
```

**This creates coordination without overstepping.**

### 8. **Technical Debt Management**

Ralph reports should distinguish "done" from "perfect."

**Categories:**
- **DONE:** Works, tested, ready for use
- **TECH DEBT:** Works but could be cleaner/faster/more robust
- **KNOWN LIMITATION:** Documented constraint

**Example:**
```markdown
## Status: DONE ✅

Feature works and is tested. User can use it.

## Tech Debt Noted:
- Sample rate conversion uses linear interpolation (works, but could use better algorithm)
- Error messages not localized (English only)
- No unit tests (manual testing only)

## Known Limitations:
- Only supports English language transcription
- Requires macOS 12+ (AVSpeechSynthesizer API)
```

**Master can decide:** Ship now, or add tech debt tasks to backlog?

### 9. **Documentation as Deliverable**

Code without docs is incomplete.

**Ralph must update:**
- **Code comments:** Why, not what (especially for complex logic)
- **development/interfaces.md:** Any API changes
- **docs/[DOMAIN].md:** User-facing features
- **agents/ralph_[domain].md:** Learnings section (append-only)

**Example Learnings Entry:**
```markdown
### 2026-01-16 - Medium Model Upgrade

- Upgraded from tiny (75MB) to medium (1.5GB) model
- Accuracy: 75% → 95% on music production terms
- Latency: 1s → 5s (acceptable tradeoff)
- Key insight: Music terms need larger vocabulary
- Recommendation: Medium for desktop, tiny for mobile
```

**These learnings accumulate institutional knowledge.**

### 10. **A/B Deployment for VST**

Ralph-VST has special workflow: **two versions coexist**.

**Workflow:**
```bash
# Ralph builds new version
./scripts/build_and_deploy.sh
# Creates: ClaudeVST_0116_2145.vst3

# Old version still active:
# ClaudeVST_0116_2100.vst3 (user is using this)

# Ralph can test new version in separate Ableton instance
# User switches when ready (remove old, add new)
```

**Benefits:**
- User never interrupted
- Ralph can develop continuously
- Easy rollback (just use old version)

**Ralph-VST reports must include:**
```markdown
## Build Info
- New build: ClaudeVST_0116_2145.vst3
- Previous build: ClaudeVST_0116_2100.vst3 (still active)
- User can switch when ready (tested safe)
```

---

## Master's Role in Ralph Effectiveness

Master ensures Ralphs work well by:

### 1. **Task Assignment**
- Pick appropriate Ralph based on [TAG:N]
- Ensure task is well-scoped
- Confirm cycle estimate reasonable
- Check dependencies available

### 2. **Progress Monitoring**
- Don't micromanage
- Check-in at ~50% cycles: "On track?"
- Offer to clarify if Ralph stuck

### 3. **Report Review**
- Read full report
- Check "Interfaces Affected" section
- Verify testing complete
- Note any coordination needed with other Ralphs

### 4. **Integration Coordination**
When multiple Ralphs' work intersects:
```
Ralph-VST needs MCP status → Ralph-MCP must provide it

Master's job:
1. Read Ralph-VST's request in report
2. Create [MCP:5] task for status endpoint
3. Assign to Ralph-MCP with context
4. Review both implementations for compatibility
5. Prepare integrated commit
```

### 5. **Commit Preparation**
- Combine changes from multiple Ralphs
- Write clear commit message referencing tasks
- Show to user for approval
- Never push without approval

**Example integrated commit:**
```bash
git add src/PluginEditor.cpp src/PluginEditor.h  # Ralph-VST
git add companions/mcp/server.py                   # Ralph-MCP
git add development/interfaces.md                  # Both updated

git commit -m "Add MCP connection status indicator

- [VST:10] VST displays MCP connection status in UI
- [MCP:5] MCP server exposes /status endpoint
- Updated interfaces.md with status API contract

Tested: Indicator updates correctly when MCP connects/disconnects
Interoperability verified between Ralph-VST and Ralph-MCP.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Anti-Patterns (What Makes Ralphs Ineffective)

### ❌ Vague Tasks
```markdown
- [ ] [VST:??] Improve audio quality
```
**Fix:** "Add LUFS metering to AudioAnalyzer" (specific, measurable)

### ❌ No Testing
Ralph: "I implemented it, should work."
**Fix:** Require testing checklist in every report

### ❌ Scope Creep
Task: Add status indicator
Ralph also: Refactors entire UI, adds 5 new features
**Fix:** Stick to task scope, log new ideas for future tasks

### ❌ No Interoperability Notes
Ralph-MCP changes API, Ralph-VST breaks silently
**Fix:** Require "Interfaces Affected" in every report

### ❌ Ignoring Cycle Limits
Task: [MCP:20], Ralph uses 40 cycles
**Fix:** Stop at cycle limit, report partial progress

### ❌ Over-Engineering
Task: Simple status check
Ralph: Implements full monitoring framework with logging, metrics, alerts
**Fix:** Build what's needed now, not future hypotheticals

### ❌ Under-Communicating
Ralph finishes, commits directly, breaks other subsystems
**Fix:** Reports → Master review → User approval → Then commit

---

## Ralph Success Metrics

How to know Ralph agents are effective:

### Quantitative
- **Cycle accuracy:** Actual cycles within ±20% of estimate
- **Task completion rate:** >90% of tasks marked [DONE] without redo
- **Testing coverage:** 100% of tasks have testing section in report
- **Interface documentation:** 100% of API changes documented
- **Zero breaking changes** without coordination

### Qualitative
- **Master confidence:** "I trust this Ralph's reports"
- **User satisfaction:** Features work as expected
- **Clean integration:** Ralph A's code works with Ralph B's
- **Knowledge accumulation:** Learnings sections grow over time
- **Technical debt tracked:** Issues noted, not hidden

---

## Checklist: Starting a New Ralph Task

Before Ralph begins work:

```markdown
## Pre-Flight Checklist

Task: [TAG:N] Description

- [ ] Task clearly describes deliverable
- [ ] Cycle estimate reasonable (5-40 range)
- [ ] "Done" criteria defined
- [ ] Dependencies available (other Ralphs finished their work)
- [ ] Relevant interfaces documented in interfaces.md
- [ ] Testing plan known (how will I verify it works?)
- [ ] Domain matches my specialty (VST/MCP/Whisper/TTS)

If any NO: Ask Master for clarification before starting.
```

---

## Checklist: Finishing a Ralph Task

Before Ralph reports [DONE]:

```markdown
## Completion Checklist

Task: [TAG:N] Description

- [ ] Implementation complete and matches spec
- [ ] Manual testing performed (all tests passed)
- [ ] Code commented (complex logic explained)
- [ ] Docs updated (interfaces.md, domain docs, learnings)
- [ ] No audio thread violations (for VST)
- [ ] No breaking changes to other Ralphs (or coordinated)
- [ ] Report written with all required sections
- [ ] Known issues/limitations documented honestly
- [ ] Recommendations for next tasks (if any)
- [ ] @Master tagged for review

If any NO: Not done yet. Keep working or ask for help.
```

---

## Communication Patterns

### Ralph → Master
```markdown
@Master: [VST:10] complete. Report at development/reports/2026-01-16_ralph_vst.md

Key points:
- Feature works, tested in Ableton ✅
- No breaking changes to other Ralphs ✅
- Interfaces updated in interfaces.md ✅
- Ready for integration into next commit

Question: Should I start [VST:8] next, or wait for Ralph-MCP to finish [MCP:15]?
```

### Master → Ralph
```markdown
@Ralph-MCP: Good report on [MCP:20]. Integration looks clean.

One request: Can you add error handling for "Ableton closed" scenario?
Teacher needs graceful degradation.

If quick (2-3 cycles), add to current task. If longer, I'll create [MCP:5]
for it.
```

### Ralph → Ralph (via Master)
```markdown
@Master: During [VST:10] I noticed Ralph-MCP's status endpoint returns
incomplete data.

Current: {"connected": true}
Needed: {"connected": true, "ableton": true, "version": "1.0"}

Can you ask Ralph-MCP to enhance this? I can work around it for now, but
better to fix properly.
```

Master creates [MCP:3] task, assigns to Ralph-MCP with context.

---

## Continuous Improvement

Ralph effectiveness improves over time through:

### Retrospectives (Post-Task)
After each task, Ralph answers:
- What went well?
- What was harder than expected?
- Was cycle estimate accurate?
- What would I do differently?

**Add to Learnings section** in agent file.

### Pattern Recognition
Master notices patterns:
- Ralph-Whisper consistently underestimates cycles → adjust estimates
- Ralph-VST excellent at threading → document best practices
- Ralph-MCP great at error handling → share approach with others

### Knowledge Sharing
Successful patterns documented in:
- Agent instruction files (append learnings)
- development/interfaces.md (API patterns)
- This effectiveness guide (update periodically)

---

## Emergency Procedures

### Ralph Stuck (Reached Cycle Limit, Not Done)
```markdown
@Master: [MCP:20] at cycle 20/20, task 60% complete.

Blocker: Ableton browser API more complex than expected. Need to understand
nested categories (Instruments → Serum → Presets → Bass).

Options:
1. Mark partial DONE, create [MCP:15] for browser navigation
2. Extend to [MCP:30] and finish properly
3. Simplify: Only support root-level instruments (no preset selection)

Recommend: Option 1 (progressive enhancement)
```

### Ralph Discovers Blocker
```markdown
@Master: Cannot complete [VST:10] - depends on Ralph-MCP's status endpoint
which doesn't exist yet.

Current cycle: 5/10
Action taken: Stubbed with file-based fallback (services/mcp_status.json)
Blocker: [MCP:5] must be completed first

Recommend: Pause [VST:10], assign [MCP:5] to Ralph-MCP, resume after.
```

### Ralph Finds Critical Bug
```markdown
@Master: URGENT - While testing [TTS:10], discovered critical bug in
SpeechSynthesizer (crashes Ableton).

Root cause: Audio thread deadlock in pullAudio()
Impact: All TTS functionality broken
Fix: In progress (3 cycles)

Created: [TTS:5] Fix audio thread deadlock (HIGH PRIORITY)
Status: Working on this first, will resume [TTS:10] after.
```

Master approves priority change.

---

## Summary: What Makes Ralph Effective?

1. **Clear Tasks** - Specific deliverables, defined success criteria
2. **Bounded Scope** - Stay in lane, delegate outside domain
3. **Autonomous Testing** - Verify own work before reporting
4. **Interface Clarity** - Know what other agents expect
5. **Cycle Discipline** - Estimate accurately, stop at limit
6. **Honest Reporting** - Document what works AND what doesn't
7. **Coordination** - Note interoperability needs explicitly
8. **Documentation** - Code + interfaces + learnings
9. **Master Integration** - Reports reviewed, changes coordinated
10. **Continuous Learning** - Patterns documented, estimates refined

**Ralph agents are effective when they're specialists who communicate well.**

---

*This is a living document. Update as we learn what works (and what doesn't).*

*Last updated: 2026-01-16*
