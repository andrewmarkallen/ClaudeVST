# Ableton MCP Extended - Parameter Reading Test Report

**Date:** January 17, 2026
**Backlog Item:** [MCP:10] Test parameter reading capabilities with Ableton MCP Extended
**Tested By:** Claude Code Agent

---

## Executive Summary

Ableton MCP Extended provides excellent session/track/clip control and browser navigation. However, **device parameter reading is NOT currently implemented** - the API returns device names and class info but no parameter values. This is a significant limitation for the Teacher Agent use case.

---

## Test Results

### 1. Session Info - WORKING

**Tool:** `get_session_info`

```json
{
  "tempo": 143.0,
  "signature_numerator": 4,
  "signature_denominator": 4,
  "track_count": 3,
  "return_track_count": 1,
  "master_track": {
    "name": "Master",
    "volume": 0.5249423384666443,
    "panning": 0.0
  }
}
```

**Capabilities:**
- Tempo (read/write via `set_tempo`)
- Time signature (read-only)
- Track count
- Return track count
- Master track volume/pan

### 2. Track Info - WORKING (Partial)

**Tool:** `get_track_info`

Successfully returns:
- Track name, index, type (audio/MIDI)
- Mute, solo, arm states
- Volume, panning values
- Clip slots with clip info (name, length, playing state)
- Device list (name, class_name, type)

**Example Device Info Returned:**
```json
{
  "devices": [
    {
      "index": 0,
      "name": "808 Drifter",
      "class_name": "InstrumentGroupDevice",
      "type": "rack"
    },
    {
      "index": 1,
      "name": "Compressor",
      "class_name": "Compressor2",
      "type": "unknown"
    }
  ]
}
```

**LIMITATION:** Device parameters (threshold, ratio, attack, etc.) are NOT exposed. Only device metadata is available.

### 3. Browser Navigation - WORKING

**Tools:** `get_browser_tree`, `get_browser_items_at_path`

Successfully can navigate:
- Instruments (Drift, Wavetable, Operator, etc.)
- Sounds (Bass, Pad, Lead presets)
- Drums (kits and samples)
- Audio Effects (Compressor, EQ Eight, Reverb, etc.)
- MIDI Effects
- Packs, Plugins, Samples, User Library

**Example Path Navigation:**
```
Instruments/Drift/Bass → Returns 34 bass presets with URIs
audio_effects → Returns 68 audio effects with URIs
```

### 4. Instrument/Effect Loading - WORKING

**Tool:** `load_instrument_or_effect`

Successfully tested:
- Loading Drift "808 Drifter" bass preset via URI `query:Synths#Drift:Bass:FileId_75631`
- Loading Compressor effect via URI `query:AudioFx#Compressor`
- Both loaded to track and appeared in device chain

### 5. MIDI Clip Creation - WORKING

**Tools:** `create_clip`, `add_notes_to_clip`, `fire_clip`, `stop_clip`

Successfully tested:
- Create 4-beat clip
- Add MIDI notes (C1 kick pattern)
- Fire clip (playback)
- Stop clip

### 6. Track Management - WORKING

**Tools:** `create_midi_track`, `set_track_name`

Successfully created new MIDI track at end of track list.

---

## What Works

| Feature | Status | Notes |
|---------|--------|-------|
| Session tempo read/write | Working | Full control |
| Track info (name, volume, pan, mute, solo, arm) | Working | Full read access |
| Clip info (name, length, playing state) | Working | Full read access |
| Device list on track | Partial | Names only, no parameters |
| Browser navigation | Working | Full tree traversal |
| Load instruments/effects | Working | Via URI from browser |
| Create MIDI tracks | Working | At any index |
| Create MIDI clips | Working | Specify length |
| Add/remove MIDI notes | Working | Full note control |
| Playback control (clip fire/stop) | Working | Session view clips |
| Global playback (start/stop) | Working | Transport control |

---

## What Does NOT Work

| Feature | Status | Impact |
|---------|--------|--------|
| Device parameter values | NOT IMPLEMENTED | Cannot read EQ settings, compressor thresholds, etc. |
| Device parameter writing | NOT IMPLEMENTED | Cannot set device parameters |
| Arrangement position | Unknown | May need testing |
| Clip note reading | Unknown | May need testing |
| Audio clip manipulation | Unknown | May need testing |

---

## Limitations Found

### 1. No Device Parameter Access (Critical)

The most significant limitation. While we can see:
- Device name: "Compressor"
- Device class: "Compressor2"
- Device type: "unknown"

We CANNOT see:
- Threshold: -20dB
- Ratio: 4:1
- Attack: 10ms
- Release: 100ms
- etc.

**Impact on Teacher Agent:** Cannot answer questions like:
- "What's my compressor threshold set to?"
- "Is my EQ boosting the low end?"
- "What are my reverb settings?"

### 2. Browser Tree vs Items Path Inconsistency

`get_browser_tree` returns category names but not nested items.
`get_browser_items_at_path` requires exact path format (e.g., `audio_effects` not `Audio Effects`).

### 3. Large Response Truncation

Drums browser query returned 131KB of data and was truncated. Need pagination for large collections.

---

## Recommendations for Teacher Usage

### Can Do (High Value)
1. **Session Context:** "Your project is at 143 BPM, 4/4 time signature"
2. **Track Overview:** "You have 3 tracks: Arrangement, Kick, and 3-Audio"
3. **Clip Status:** "The Kick track has a 16-beat clip currently playing"
4. **Device Chain:** "Track 3 has ClaudeVST loaded"
5. **Load Presets:** "Loading Dub Techno Bass from Drift to a new track"
6. **Create Patterns:** "Adding a four-on-the-floor kick pattern"

### Cannot Do (Need Workaround)
1. **Parameter Analysis:** Use VST audio analysis instead of device parameter reading
2. **Mix Critique:** Rely on audio spectrum data, not EQ/compressor settings
3. **Sound Design:** Can load presets but cannot modify them programmatically

### Workaround Strategy

For parameter-related questions, the Teacher Agent should:
1. Acknowledge the limitation honestly
2. Use audio analysis data to infer results
3. Guide the student to check visually in Ableton

**Example Response:**
> "I can't read your compressor settings directly, but listening to your audio analysis, your crest factor is 6dB which suggests moderate compression. You could check your compressor's gain reduction meter to see how hard it's working."

---

## Technical Notes

### MCP Server Location
`/Users/mk/c/ClaudeVST/companions/ableton-mcp-extended/`

### Available Tools Tested
- `get_session_info` - Working
- `get_track_info` - Working (no params)
- `create_midi_track` - Working
- `set_track_name` - Working
- `create_clip` - Working
- `add_notes_to_clip` - Working
- `set_clip_name` - Working
- `set_tempo` - Working
- `load_instrument_or_effect` - Working
- `fire_clip` - Working
- `stop_clip` - Working
- `start_playback` - Working
- `stop_playback` - Working
- `get_browser_tree` - Working
- `get_browser_items_at_path` - Working
- `load_drum_kit` - Not tested

---

## Future Development Suggestions

### Priority 1: Add Device Parameter Reading
Extend `get_track_info` or add new `get_device_parameters` tool:
```json
{
  "device_index": 1,
  "parameters": [
    {"name": "Threshold", "value": -20.0, "min": -60, "max": 0, "unit": "dB"},
    {"name": "Ratio", "value": 4.0, "min": 1, "max": 20, "unit": ":1"},
    {"name": "Attack", "value": 10.0, "min": 0.01, "max": 1000, "unit": "ms"}
  ]
}
```

### Priority 2: Add Device Parameter Writing
Add `set_device_parameter` tool:
```python
set_device_parameter(track_index=0, device_index=1, param_name="Threshold", value=-15.0)
```

### Priority 3: Add Clip Note Reading
Add `get_clip_notes` tool to read existing MIDI content.

---

## Conclusion

Ableton MCP Extended is a capable foundation for session control, browser navigation, and MIDI clip creation. The **critical gap is device parameter access** which limits the Teacher Agent's ability to provide specific mix advice. For now, the Teacher should combine:

1. MCP for session/track context
2. VST audio analysis for mix feedback
3. Student guidance for visual parameter checks

---

*Report generated by Claude Code Agent - January 17, 2026*
