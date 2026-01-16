---
description: "Start autonomous Teacher agent monitoring"
argument-hint: "[start|stop|status]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/teacher-monitor.sh:*)"]
hide-from-slash-command-tool: "true"
---

# Teacher Agent Command

Execute the teacher monitor script:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/teacher-monitor.sh" $ARGUMENTS
```

## What Teacher Agent Does

Teacher is an autonomous music production tutor that:
- **Monitors** `messages/to_claude.json` for new user messages
- **Responds automatically** with production advice and feedback
- **Uses Ableton MCP tools** to demonstrate concepts (with permission)
- **Analyzes audio** in real-time from audio_analysis.json
- **Specializes in** hypnotic techno and BCCO Records production

## Commands

- `/teacher start` - Start background monitoring
- `/teacher stop` - Stop monitoring
- `/teacher status` - Check if running
- `/teacher help` - Show this help

## Teacher's Capabilities

**Music Production Teaching:**
- Theory (scales, harmony, rhythm)
- Sound design (FM, subtractive, wavetable synthesis)
- Mixing and mastering for club systems
- Genre-specific techniques (techno, house, DnB)

**Ableton Control (MCP):**
- Create tracks, clips, and MIDI patterns
- Load instruments and effects
- Adjust parameters for demonstrations
- Import audio files (reference tracks)
- Always asks permission before modifying your session

**Audio Analysis:**
- RMS/Peak levels and dynamics
- 8-band frequency spectrum analysis
- Mix feedback and improvement suggestions
- Genre-appropriate reference targets

## How It Works

Once started, Teacher runs as a background task that:

1. **Polls** messages/to_claude.json every 2 seconds
2. **Detects** new messages (timestamp check)
3. **Processes** message with full audio context
4. **Responds** by writing to messages/from_teacher.json
5. **Continues** monitoring until stopped

Teacher maintains conversation context and remembers student progress across sessions.

## Voice Input Integration

Teacher works seamlessly with voice input:
- Use `companions/voice/voice_listener.py` to speak messages
- Teacher automatically receives and processes them
- TTS speaks responses back through `companions/tts/tts_watcher.py`

Complete voice conversation loop without manual intervention!

## Example Workflow

```bash
# Start Teacher
/teacher start

# In another terminal, run voice input
./companions/voice/voice_listener.py

# In another terminal, run TTS output
python3 companions/tts/tts_watcher.py

# Now speak into mic:
"Hey Teacher, what tempo is good for hypnotic techno?"

# Teacher automatically:
# - Detects message
# - Processes with expertise
# - Responds to messages/from_teacher.json
# - TTS speaks response
```

## Stop Teacher

```bash
/teacher stop
```

Teacher will gracefully stop monitoring and save state.
