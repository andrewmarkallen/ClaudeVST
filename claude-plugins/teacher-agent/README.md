# Teacher Agent Skill

Autonomous music production teacher for ClaudeVST that monitors messages and responds automatically.

## Installation

```bash
cd ~/.claude/plugins
ln -s /Users/mk/c/ClaudeVST/claude-plugins/teacher-agent teacher-agent
```

Or install via marketplace (if published).

## Usage

```bash
# Start Teacher monitoring
/teacher start

# Check status
/teacher status

# Stop monitoring
/teacher stop

# Get help
/teacher help
```

## How It Works

Teacher runs as a background monitoring service that:
1. Polls `messages/to_claude.json` every 2 seconds
2. Detects new messages (ignores "M:" prefix for Master)
3. Processes with music production expertise
4. Writes responses to `messages/from_teacher.json`
5. Can use Ableton MCP tools (always asks permission first)

## Integration

Works seamlessly with:
- **Voice input:** `companions/voice/voice_listener.py`
- **TTS output:** `companions/tts/tts_watcher.py`
- **Ableton MCP:** Control Ableton for demonstrations
- **Document search:** Search production knowledge base

## Teacher's Expertise

- Hypnotic techno and BCCO Records production
- Music theory for electronic music
- Sound design (FM, subtractive, wavetable)
- Mixing and mastering for club systems
- Real-time audio analysis and feedback

## Architecture

```
User voice input
    ↓
messages/to_claude.json
    ↓
Teacher (monitoring) ← reads every 2s
    ↓
Process + MCP tools
    ↓
messages/from_teacher.json
    ↓
TTS speaks response
```

Fully autonomous conversation loop!
