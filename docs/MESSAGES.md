# Message Format Specification

ClaudeVST uses file-based JSON messaging to communicate with Claude Code sessions. This approach avoids API costs by leveraging the Claude Code subscription.

---

## File Locations

All message files are in the project's `messages/` directory:

```
/Users/mk/c/ClaudeVST/messages/
├── to_claude.json      # User messages (VST → Claude)
├── from_claude.json    # Claude responses (Claude → VST)
├── audio_analysis.json # Real-time audio data (VST → Claude)
└── .gitkeep
```

---

## to_claude.json

**Direction:** VST → Claude

Written by the VST when the user sends a message (typing or voice).

### Schema

```json
{
  "timestamp": 1768587202680,
  "message": "How does my mix sound?",
  "audio_context": "=== AUDIO ANALYSIS ===\n..."
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | integer | Unix timestamp in milliseconds |
| `message` | string | User's question or command |
| `audio_context` | string | Formatted audio analysis + Ableton session info |

### Example with Full Context

```json
{
  "timestamp": 1768587202680,
  "message": "Can you launch the kick track clip?",
  "audio_context": "=== AUDIO ANALYSIS ===\nRMS Level: L=-52.6dB, R=-100.0dB\nPeak Level: L=-45.6dB, R=-100.0dB\nCrest Factor: 3.5dB\nSpectrum: Sub=3.27dB, Bass=4.98dB, Low-Mid=0.43dB, Mid=-19.55dB, Upper-Mid=-31.41dB, Presence=-28.36dB, Brilliance=-36.39dB, Air=-50.09dB\n\n=== ABLETON SESSION ===\nTempo: 120.0 BPM\nTracks: 3\nTrack names:\n  0: Arrangement\n  1: Kick\n  2: 3-Audio\n"
}
```

---

## from_claude.json

**Direction:** Claude → VST

Written by Claude Code when responding. The VST polls this file at 2Hz.

### Schema

```json
{
  "timestamp": 1768587210000,
  "response": "Your response text here",
  "actions": [
    {"action": "action_type", ...params}
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | integer | Yes | Unix timestamp in milliseconds |
| `response` | string | Yes | Text response to display and speak |
| `actions` | array | No | OSC commands to execute |

### Response-Only Example

```json
{
  "timestamp": 1768587210000,
  "response": "Your mix is hitting -14 dB RMS with good headroom. The bass is prominent at 35dB which fits electronic music well."
}
```

### Response with Actions Example

```json
{
  "timestamp": 1768587210000,
  "response": "Firing the Kick clip!",
  "actions": [
    {"action": "fire_clip", "track": "Kick", "clip_index": 0}
  ]
}
```

### Multiple Actions Example

```json
{
  "timestamp": 1768587300000,
  "response": "Muting bass and soloing drums for comparison.",
  "actions": [
    {"action": "mute", "track": "Bass"},
    {"action": "solo", "track": "Drums"}
  ]
}
```

---

## audio_analysis.json

**Direction:** VST → Claude (continuous)

Written every ~500ms with real-time audio metrics. Useful for Claude to passively monitor audio state.

### Schema

```json
{
  "timestamp": 1768589186709,
  "levels": {
    "rms_left_db": -50.55,
    "rms_right_db": -100.0,
    "peak_left_db": -44.09,
    "peak_right_db": -100.0,
    "crest_factor_db": 3.23
  },
  "spectrum": {
    "sub_db": -4.76,
    "bass_db": -1.45,
    "low_mid_db": -14.34,
    "mid_db": -19.82,
    "upper_mid_db": -38.93,
    "presence_db": -47.67,
    "brilliance_db": -53.75,
    "air_db": -55.14
  },
  "ableton": {
    "tempo": 120.0,
    "num_tracks": 3
  }
}
```

### Levels Fields

| Field | Unit | Description |
|-------|------|-------------|
| `rms_left_db` | dB | Left channel RMS (average loudness) |
| `rms_right_db` | dB | Right channel RMS |
| `peak_left_db` | dB | Left channel peak |
| `peak_right_db` | dB | Right channel peak |
| `crest_factor_db` | dB | Peak - RMS (dynamics indicator) |

### Spectrum Fields (Frequency Bands)

| Field | Frequency Range | Typical Content |
|-------|-----------------|-----------------|
| `sub_db` | 20-60 Hz | Sub bass, kick fundamentals |
| `bass_db` | 60-250 Hz | Bass, kick body |
| `low_mid_db` | 250-500 Hz | Low vocals, guitar body |
| `mid_db` | 500-2000 Hz | Main vocal presence |
| `upper_mid_db` | 2000-4000 Hz | Vocal clarity, snare |
| `presence_db` | 4000-6000 Hz | Definition, attack |
| `brilliance_db` | 6000-12000 Hz | Brightness, cymbals |
| `air_db` | 12000-20000 Hz | Air, sparkle |

### Ableton Fields (if connected)

| Field | Type | Description |
|-------|------|-------------|
| `tempo` | float | Current session tempo in BPM |
| `num_tracks` | int | Number of tracks in session |

---

## Action Format

Actions in `from_claude.json` follow this structure:

```json
{"action": "action_type", "param1": value1, "param2": value2}
```

### Supported Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `play` | - | Start playback |
| `stop` | - | Stop playback |
| `tempo` | `value` (float) | Set tempo |
| `mute` | `track` or `track_index` | Mute track |
| `unmute` | `track` or `track_index` | Unmute track |
| `solo` | `track` or `track_index` | Solo track |
| `unsolo` | `track` or `track_index` | Unsolo track |
| `volume` | `track`, `value` (0-1) | Set track volume |
| `fire_clip` | `track`, `clip_index` | Launch clip |
| `stop_clip` | `track`, `clip_index` | Stop clip |
| `fire_scene` | `scene_index` | Launch scene |

Track can be specified by name (`"track": "Bass"`) or index (`"track_index": 0`). Names are matched case-insensitively.

---

## Polling Behavior

### VST Polling (ClaudeClient)
- Polls `from_claude.json` at **2 Hz** (every 500ms)
- Checks file modification time to detect changes
- Only processes if timestamp > last processed timestamp
- Executes actions asynchronously on message thread

### Audio Analysis Writing
- Written every **~500ms** (15 frames at 30fps timer)
- Atomic file writes (replaceWithText)
- Includes Ableton info only if OSC connected

---

## Timestamp Format

All timestamps are **Unix milliseconds** (not seconds):

```cpp
juce::Time::currentTimeMillis()  // Returns int64
```

Python equivalent:
```python
int(time.time() * 1000)  # Multiply seconds by 1000
```

---

## Writing Responses (Claude Code)

When responding to a message from the VST:

```python
import json
import time
from pathlib import Path

response = {
    "timestamp": int(time.time() * 1000),
    "response": "Your mix sounds great! The RMS level of -14dB is perfect for mixing.",
    "actions": []  # Optional
}

path = Path.home() / "c/ClaudeVST/messages/from_claude.json"
path.write_text(json.dumps(response, indent=2))
```

---

## Source Files

- `src/ClaudeClient.cpp` - Message I/O, polling logic
- `src/ClaudeClient.h` - File paths, callbacks
- `src/PluginEditor.cpp:230` - Audio analysis JSON building
- `src/OSCClient.cpp:242` - Action execution

---

## See Also

- [ABLETONOSC.md](ABLETONOSC.md) - Details on action execution
- [SYSTEM.md](SYSTEM.md) - Overall data flow
- [TTS.md](TTS.md) - How responses are spoken
