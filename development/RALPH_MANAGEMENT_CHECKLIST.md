# Ralph Agent Management Checklist

**Quick Reference:** How to start, monitor, and ensure Ralph agents work effectively.

---

## Starting a Ralph Agent Session

### 1. Explicit Role Assignment
```bash
# In terminal:
claude-code

# First message MUST establish identity:
"You are Ralph-VST. Read agents/ralph_vst.md and development/RALPH_EFFECTIVENESS.md first, then confirm you understand your role."
```

**✅ Good start:**
```
Ralph-VST: I've read my instructions. I understand:
- My domain: C++/JUCE VST development
- Write permissions: src/Plugin*.*, CMakeLists.txt, my reports
- Cycle discipline: Stop at estimate, report progress
- Testing required before marking DONE

Ready for task assignment from backlog.
```

**❌ Bad start:**
```
Claude: Hi! I'm ready to help with anything you need!
```
→ **Not Ralph. Re-assign identity.**

### 2. Pre-Flight Check

Before assigning task:
- [ ] Task in backlog clearly scoped with [TAG:N]
- [ ] "Done" criteria defined
- [ ] Dependencies available (other Ralphs finished their work)
- [ ] Interfaces documented in development/interfaces.md
- [ ] Cycle estimate reasonable (5-40 range)

### 3. Task Assignment Format
```markdown
@Ralph-VST: Task [VST:10] assigned to you.

See development/backlog.md line X for full details.

Key points:
- Add MCP connection status indicator to UI
- Poll every 2 seconds (message thread, not audio!)
- Visual: ✓ (green) or ✗ (red)
- Must not block audio thread

Report when complete. Estimated 10 cycles.
```

---

## Monitoring Ralph Progress

### Don't Micromanage

Ralph works autonomously through cycles. Only check-in:

**At ~50% cycles:**
```
Master: "Ralph-VST, you're at cycle 5/10. On track?"

Ralph-VST: "Yes, status indicator working. Testing poll frequency now. Should finish by cycle 10."
```

**If stuck:**
```
Ralph-VST: "Cycle 6/10. Blocked: MCP server doesn't expose status endpoint yet. Need Ralph-MCP to create [MCP:5] first."

Master: "Good catch. @Ralph-MCP: [MCP:5] added to backlog (HIGH priority). Ralph-VST, pause [VST:10] until dependency ready."
```

### Red Flags

**🚩 Ralph overstepping boundaries:**
```
Ralph-VST: "Also refactored the entire UI system, added 5 new features..."
```
→ **Stop.** "Stick to [VST:10] scope. Log new ideas as separate backlog tasks."

**🚩 Ralph writing to wrong files:**
```
Ralph-MCP: "Fixed bug in src/PluginProcessor.cpp..."
```
→ **Stop.** "That's Ralph-VST's domain. Note the bug in your report, Master coordinates fix."

**🚩 Ralph skipping testing:**
```
Ralph-Whisper: "Implementation done. Should work."
```
→ **Stop.** "Testing checklist required. Verify accuracy on 20+ phrases before marking DONE."

---

## Reviewing Ralph Reports

### Report Checklist

When Ralph says "Report ready," review for:

**Required Sections:**
- [ ] **Changes:** What files modified, what was done
- [ ] **Testing:** ✅ checklist showing all tests passed
- [ ] **Interfaces Affected:** What other Ralphs need to know
- [ ] **Performance Impact:** Speed/memory changes if relevant
- [ ] **Known Issues:** Honest limitations documented
- [ ] **@Master tag:** Explicit handoff for review

**Quality Indicators:**

✅ **Good report:**
```markdown
# Ralph-Whisper Report
**Cycles:** 15/15 (on estimate)
**Task:** [WHISPER:15] Upgrade to medium model

## Changes
- Downloaded ggml-medium.bin to whisper.cpp/models/
- Updated CMakeLists.txt line 14: WHISPER_MODEL_PATH
- Tested transcription accuracy

## Testing
- ✅ 20 test phrases: 95% accuracy (up from 75%)
- ✅ GPU acceleration working (Metal)
- ✅ No audio thread blocking
- ⚠️  Latency: 1s → 5s (acceptable tradeoff)

## Interfaces Affected
- Ralph-VST must rebuild (model path in CMakeLists changed)
- No API changes to SpeechRecognizer class

@Master: Ready for integration. Ralph-VST rebuild required.
```

❌ **Bad report:**
```markdown
# Ralph Report
I did the thing. It works I think.

@Master: Done.
```

### Response to Good Report

```
Master: "Excellent work, Ralph-Whisper. Report looks complete.

Integration plan:
1. I'll notify Ralph-VST to rebuild with new model
2. User will test accuracy improvement
3. If good, I'll prepare commit combining your changes

Approved. Adding to next commit."
```

### Response to Incomplete Report

```
Master: "Ralph-Whisper, report missing testing section. Need:
- Accuracy metrics (before/after)
- Latency measurements
- GPU acceleration verification

Please complete testing and update report."
```

---

## Coordinating Multiple Ralphs

### Scenario: Ralphs Need Each Other's Work

**Example:** Ralph-VST needs Ralph-MCP's status endpoint

**Step 1: Ralph-VST Reports Dependency**
```markdown
## Interfaces Needed
Ralph-MCP must expose: GET http://localhost:11000/status

I've stubbed VST code to use services/mcp_status.json as fallback.
Can proceed when Ralph-MCP implements endpoint.
```

**Step 2: Master Creates Task**
```markdown
# Added to backlog:
- [MCP:5] Expose status endpoint for Ralph-VST
  Priority: HIGH (blocks [VST:10])

@Ralph-MCP: Please implement next. Ralph-VST waiting on this.
```

**Step 3: Master Coordinates Integration**
```markdown
Ralph-MCP finished [MCP:5].
Ralph-VST: Dependency ready. You can resume [VST:10] and remove fallback.

I'll integrate both changes in one commit when both complete.
```

### Integration Commit Format

```bash
git add src/PluginEditor.cpp src/PluginEditor.h    # Ralph-VST
git add companions/mcp/server.py                     # Ralph-MCP
git add development/interfaces.md                    # Both updated

git commit -m "Add MCP connection status to VST UI

[VST:10] VST displays MCP connection in status bar
[MCP:5] MCP server exposes GET /status endpoint

- Ralph-VST: Status indicator with 2s polling
- Ralph-MCP: Returns {connected, ableton, version}
- Tested: Indicator updates when MCP connects/disconnects
- Documented: development/interfaces.md updated

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Show to user BEFORE pushing:**
```
Master: "Ralph-VST and Ralph-MCP finished their tasks.

Prepared commit (above). Changes verified compatible.

Approve to push?"
```

---

## Emergency Procedures

### Ralph Reports Critical Bug

```
Ralph-TTS: "URGENT - Discovered audio thread deadlock in SpeechSynthesizer.
All TTS functionality broken. Working on fix [TTS:5]."

Master: "Understood. Prioritize [TTS:5]. User, be aware TTS is temporarily down.
Ralph-TTS working on fix."
```

### Ralph Stuck Beyond Cycle Limit

```
Ralph-MCP: "Cycle 20/20. Task 60% complete.
Blocker: Browser API complexity underestimated.

Options:
1. Mark partial DONE, create [MCP:15] for remaining 40%
2. Extend to [MCP:30]

Recommend: Option 1 (progressive delivery)"

Master: "Option 1 approved. Mark what you have as DONE.
I'll create [MCP:15] for remaining work.
Good job stopping at cycle limit and reporting honestly."
```

### Ralph Discovers Scope Creep

```
Ralph-VST: "While implementing [VST:10], noticed UI needs full redesign
for proper status indicators. This is becoming [VST:40]."

Master: "Stop at [VST:10] scope (simple status label).
Log 'Full UI redesign' as separate [VST:40] task for later.
Deliver incremental improvement now, perfection later."
```

---

## Daily Standup (Optional)

If running multiple Ralphs simultaneously:

```
Master: "Ralph status check:"

Ralph-VST: "[VST:10] at cycle 7/10, on track, testing in progress"
Ralph-MCP: "[MCP:20] at cycle 15/20, clip creation works, instrument loading next"
Ralph-Whisper: "Idle, waiting for next task"
Ralph-TTS: "[TTS:10] complete, report at development/reports/..."

Master: "Thanks team. Ralph-TTS, I'll review your report shortly."
```

---

## Success Indicators

### Ralph is Effective When:

✅ Cycle estimates accurate (±20%)
✅ Reports complete with all sections
✅ Testing done before marking DONE
✅ Stays in lane (doesn't touch other domains)
✅ Coordinates via reports (doesn't break other subsystems)
✅ Stops at cycle limit and reports honestly
✅ Documents changes (code, interfaces, learnings)

### Ralph Needs Correction When:

❌ Constantly running over cycles
❌ Reports incomplete or missing testing
❌ Scope creep (doing more than task specifies)
❌ Writing to files outside their domain
❌ Committing without Master review
❌ Not coordinating interface changes

---

## Quick Commands

### Assign Task
```
@Ralph-[DOMAIN]: [TAG:N] assigned. See backlog line X. Report when done.
```

### Check Progress
```
Ralph-[DOMAIN]: Status check on [TAG:N]?
```

### Request Report
```
Ralph-[DOMAIN]: Task looks complete. Please generate report.
```

### Extend Estimate
```
Ralph-[DOMAIN]: Approved to extend [TAG:N] from N to M cycles. Report progress.
```

### Pause Task
```
Ralph-[DOMAIN]: Pause [TAG:N], dependency missing. Resume when [OTHER-TAG] completes.
```

### Approve Report
```
@Ralph-[DOMAIN]: Report approved. Changes will be in next commit. Well done.
```

---

## Common Mistakes to Avoid

### User Mistakes

❌ **Asking Ralph to do everything:**
```
User to Ralph-VST: "Also fix the MCP server and improve TTS quality"
```
✅ **Correct:** Each Ralph stays in lane. Create separate tasks for other domains.

❌ **No explicit role assignment:**
```
User: "Hey Claude, help me with the VST"
Claude: *acts as general assistant*
```
✅ **Correct:** "You are Ralph-VST. Read agents/ralph_vst.md first."

❌ **Micromanaging cycles:**
```
Master: "Ralph-VST, status? (after every cycle)"
```
✅ **Correct:** Check-in at ~50%, let Ralph work autonomously.

### Master Mistakes

❌ **Skipping report review:**
```
Master: "Ralph finished. I'll commit now."
*Breaks other subsystems*
```
✅ **Correct:** Review report, check interoperability, then prepare commit.

❌ **Vague task assignment:**
```
Master: "Ralph-MCP, make MCP better"
```
✅ **Correct:** Point to specific [MCP:N] task in backlog with clear deliverable.

❌ **Committing without user approval:**
```
Master: *pushes commit*
User: "Wait, I didn't approve that!"
```
✅ **Correct:** Show commit message, wait for explicit "yes" before pushing.

### Ralph Mistakes

❌ **Scope creep:**
```
Task: Add status indicator
Ralph: "Also refactored entire UI, added dark mode, implemented settings..."
```
✅ **Correct:** Deliver task scope, log extras as future tasks.

❌ **No testing:**
```
Ralph: "Implementation done. [DONE]"
Master: "Did you test it?"
Ralph: "No, but it should work..."
```
✅ **Correct:** Testing checklist MANDATORY before [DONE].

❌ **Breaking other subsystems:**
```
Ralph-MCP: "Changed status API format (didn't tell Ralph-VST)"
*VST breaks*
```
✅ **Correct:** Document interface changes, coordinate through Master.

---

## Summary: The Ralph Management Loop

1. **Assign** well-scoped task with [TAG:N]
2. **Monitor** lightly (~50% check-in)
3. **Review** report for completeness
4. **Coordinate** integration if multiple Ralphs
5. **Commit** only with user approval
6. **Learn** from cycle accuracy, update estimates

**Ralph agents are effective specialists when given clear tasks and trusted to deliver.**

---

*Keep this checklist handy when managing Ralph agents.*

*Last updated: 2026-01-16*
