# Starting Teacher System - Quick Guide

## NEW: Autonomous Ralph Loop (Recommended)

Ralph Loop runs as Teacher directly - fully autonomous, no manual checking!

### Terminal 1: Ralph Loop (Teacher) 🎓
```bash
cd /Users/mk/c/ClaudeVST
claude-code
# Then run:
/ralph-loop
```

**What happens:**
- Ralph becomes Teacher
- Monitors `messages/to_claude.json` every 5 seconds
- Responds directly to `messages/from_teacher.json`
- Maintains full conversation context
- Runs forever until you cancel

### Terminal 2: TTS Output (optional) 🔊
```bash
cd /Users/mk/c/ClaudeVST
python3 companions/tts/tts_watcher.py
```
Watches `messages/from_teacher.json` and speaks Teacher's responses.

---

## Testing

### Test message already created:
A test message is in `messages/to_claude.json`. When you start Ralph Loop, it should detect and respond within 5 seconds.

### Verify it worked:
```bash
cat messages/from_teacher.json
```
Should have a new response with recent timestamp.

### Send a new message:
```bash
echo '{"timestamp": '$(date +%s)000', "message": "What BPM for hypnotic techno?", "audio_context": ""}' > messages/to_claude.json
```

Or use the VST!

---

## Voice Recognition in VST

### In Ableton:
1. **Rescan plugins** (Preferences → Plug-Ins → Rescan)
2. **Add ClaudeVST_0116_1900** to any audio track
3. **Set monitoring to "In"** on that track
4. **Hold the [Mic] button** and speak
5. **Release** to transcribe and send

### Requirements:
- Microphone input routed to the track with ClaudeVST
- Whisper model at `whisper.cpp/models/ggml-tiny.bin` (77MB)

---

## Complete Flow (Autonomous)

```
1. You speak in VST → [Mic] button
   ↓
2. Whisper transcribes locally (no API)
   ↓
3. VST writes → messages/to_claude.json
   ↓
4. Ralph Loop detects new message (5s poll)
   ↓
5. Ralph (as Teacher) reads message + audio context
   ↓
6. Ralph writes response → messages/from_teacher.json
   ↓
7. TTS Watcher speaks response 🔊
   ↓
8. VST displays response in chat
```

---

## Alternative: Manual Launch

If `/ralph-loop` skill not available, use the launcher:

```bash
./scripts/launch-task.sh teacher-orchestrator
```

Follow the instructions it prints.

---

## Files

| File | Purpose |
|------|---------|
| `messages/to_claude.json` | User messages (VST writes here) |
| `messages/from_teacher.json` | Teacher responses |
| `messages/audio_analysis.json` | Real-time audio data |
| `.ralph-last-processed` | Timestamp of last processed message |

---

## Troubleshooting

### Ralph not responding
- Check `.ralph-last-processed` is lower than message timestamp
- Reset: `echo "0" > .ralph-last-processed`
- Ensure to_claude.json message doesn't start with "M:"

### "Whisper model not loaded" in VST
- Check: `ls whisper.cpp/models/ggml-tiny.bin`
- Rebuild: `cmake --build build && ./scripts/post_build.sh`

### TTS not speaking
- Check tts_watcher.py is running
- Test manually: `say "Hello"`

### VST not appearing in Ableton
- Rescan plugins in Preferences
- Look for `ClaudeVST_0116_1900`

---

## MCP Tools (Teacher can use)

When Ralph Loop is running as Teacher, it has access to Ableton MCP:
- Create tracks and clips
- Load instruments (Operator, Wavetable, even Serum)
- Add/edit MIDI notes
- Control transport and tempo
- Adjust device parameters

**Teacher always asks permission before making changes!**

---

*Generated: 2026-01-17*
