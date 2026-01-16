---
description: "Show Teacher agent help"
argument-hint: ""
hide-from-slash-command-tool: "false"
---

# Teacher Agent - Help

## Overview

Teacher is an autonomous music production tutor that monitors messages and responds automatically using MCP tools.

## Commands

- `/teacher start` - Start background monitoring
- `/teacher stop` - Stop monitoring
- `/teacher status` - Check if running
- `/teacher help` - Show this help

## What Teacher Does

**Expertise:**
- Hypnotic techno & BCCO Records production
- Music theory for electronic music
- Sound design (FM, subtractive, wavetable)
- Mixing and mastering for club systems
- Real-time audio analysis and feedback

**Autonomous Features:**
- Monitors messages/to_claude.json every 2 seconds
- Responds automatically to messages/from_teacher.json
- Uses Ableton MCP tools for demonstrations (with permission)
- Analyzes audio context from audio_analysis.json
- Tracks student progress over time

## Complete Voice Loop

```
Voice Input → Whisper → to_claude.json
    ↓
Teacher (monitoring)
    ↓
from_teacher.json → TTS → Speech Output
```

## Integration

**Voice Input:**
```bash
./companions/voice/voice_listener.py
```

**TTS Output:**
```bash
python3 companions/tts/tts_watcher.py
```

**Ableton:**
- Ensure AbletonMCP Remote Script is enabled
- Teacher can create tracks, clips, load instruments
- Always asks permission before modifying session

## Example Usage

1. Start Teacher: `/teacher start`
2. Start voice input in Terminal
3. Start TTS in another Terminal
4. Speak: "What tempo for hypnotic techno?"
5. Teacher auto-responds through TTS!

## Documentation

- Full instructions: `/Users/mk/c/ClaudeVST/agents/teacher_agent.md`
- MCP reference: `/Users/mk/c/ClaudeVST/docs/ABLETON_MCP.md`
- System overview: `/Users/mk/c/ClaudeVST/docs/SYSTEM.md`
