# AbletonOSC Integration

ClaudeVST integrates with [AbletonOSC](https://github.com/ideoforms/AbletonOSC), an open-source project by ideoforms that exposes Ableton Live's internal state via OSC (Open Sound Control).

---

## What is AbletonOSC?

AbletonOSC is a MIDI Remote Script that runs inside Ableton Live and creates a bidirectional OSC interface. It allows external applications to:

- **Query** session state (tempo, track names, device parameters)
- **Send commands** (play, stop, mute, fire clips)
- **Receive updates** when state changes

---

## Installation

### 1. Download AbletonOSC

Clone or download from: https://github.com/ideoforms/AbletonOSC

### 2. Install the Remote Script

Copy the `AbletonOSC` folder to Ableton's Remote Scripts directory:

```
~/Music/Ableton/User Library/Remote Scripts/AbletonOSC/
```

The folder structure should be:
```
Remote Scripts/
└── AbletonOSC/
    ├── __init__.py
    ├── abletonosc/
    │   ├── __init__.py
    │   ├── handler.py
    │   ├── track.py
    │   └── ...
    └── pythonosc/
        └── ...
```

### 3. Enable in Ableton Live

1. Open Ableton Live
2. Go to **Preferences → Link/Tempo/MIDI**
3. Under **Control Surface**, select **AbletonOSC** from dropdown
4. Input/Output can be left as "None" (uses OSC, not MIDI)

When successful, you'll see "AbletonOSC: listening for OSC on port 11000" in Ableton's Log.txt.

---

## OSC Ports

| Port | Direction | Description |
|------|-----------|-------------|
| **11000** | Send to Ableton | ClaudeVST → AbletonOSC |
| **11001** | Receive from Ableton | AbletonOSC → ClaudeVST |

These are the default ports. ClaudeVST's `OSCClient` connects to `127.0.0.1:11000` and listens on `11001`.

---

## Available Queries

ClaudeVST uses these queries to gather session context:

### Song Information
```
/live/song/get/tempo          → Returns current BPM (float)
/live/song/get/num_tracks     → Returns track count (int)
```

### Track Information
```
/live/track/get/name <index>  → Returns track name at index (string)
/live/track/get/mute <index>  → Returns mute state (0/1)
/live/track/get/solo <index>  → Returns solo state (0/1)
```

### Device Information
```
/live/device/get/parameters <track> <device>  → Returns parameter values
```

---

## Available Commands

ClaudeVST can execute these actions via the `OSCClient`:

### Transport
```
/live/song/start_playing      → Start playback
/live/song/stop_playing       → Stop playback
/live/song/set/tempo <bpm>    → Set tempo (20-999 BPM)
```

### Track Control
```
/live/track/set/mute <index> <0|1>    → Mute/unmute track
/live/track/set/solo <index> <0|1>    → Solo/unsolo track
/live/track/set/volume <index> <0-1>  → Set track volume (0.85 ≈ 0dB)
```

### Clip Control
```
/live/clip/fire <track> <clip>   → Launch clip at track/clip index
/live/clip/stop <track> <clip>   → Stop clip
/live/scene/fire <scene>         → Launch entire scene
```

---

## How ClaudeVST Uses OSCClient

### Connection
```cpp
// OSCClient.h - Default ports
static constexpr int sendPort = 11000;
static constexpr int receivePort = 11001;

// Connect on editor creation
if (oscClient.connect()) {
    appendToChat("System", "Connected to AbletonOSC");
}
```

### Gathering Session Context
When the user sends a message, ClaudeVST includes Ableton session info:
```cpp
if (oscClient.isConnected()) {
    context += "\n=== ABLETON SESSION ===\n";
    context += oscClient.getSessionInfo();  // Tempo, track names, etc.
}
```

### Executing Actions from Claude
Claude can respond with actions that ClaudeVST executes:
```json
{
  "response": "Muting the bass track",
  "actions": [
    {"action": "mute", "track": "Bass"}
  ]
}
```

The `executeAction()` method parses these and sends OSC:
```cpp
// Find track by name, send OSC command
int trackIndex = findTrackByName("Bass");
muteTrack(trackIndex, true);  // Sends /live/track/set/mute
```

---

## Action Types

ClaudeVST's `OSCClient::executeAction()` supports:

| Action | Parameters | Example |
|--------|------------|---------|
| `play` | (none) | `{"action": "play"}` |
| `stop` | (none) | `{"action": "stop"}` |
| `tempo` | `value` | `{"action": "tempo", "value": 128}` |
| `mute` | `track` or `track_index` | `{"action": "mute", "track": "Bass"}` |
| `unmute` | `track` or `track_index` | `{"action": "unmute", "track_index": 0}` |
| `solo` | `track` or `track_index` | `{"action": "solo", "track": "Drums"}` |
| `unsolo` | `track` or `track_index` | `{"action": "unsolo", "track": "Drums"}` |
| `volume` | `track`, `value` | `{"action": "volume", "track": "Bass", "value": 0.7}` |
| `fire_clip` | `track`, `clip_index` | `{"action": "fire_clip", "track": "Kick", "clip_index": 0}` |
| `stop_clip` | `track`, `clip_index` | `{"action": "stop_clip", "track": "Kick", "clip_index": 0}` |
| `fire_scene` | `scene_index` | `{"action": "fire_scene", "scene_index": 2}` |

---

## Troubleshooting

### AbletonOSC Not Responding
1. Check Ableton Preferences → Control Surface is set to AbletonOSC
2. Look for "listening for OSC on port 11000" in `~/Library/Preferences/Ableton/Live X.X/Log.txt`
3. Ensure no other application is using port 11000

### Track Not Found
- Track names are matched case-insensitively with `contains()`
- Use exact names or partial matches: "Kick" matches "01-Kick" or "Kick Drum"
- Alternatively, use `track_index` directly

### Commands Not Executing
- Verify `oscClient.isConnected()` returns true
- Check Ableton's Log.txt for OSC errors
- Some commands require the track/clip to exist

---

## Source Files

- `src/OSCClient.cpp` - OSC sender/receiver implementation
- `src/OSCClient.h` - Interface and port configuration
- `src/PluginEditor.cpp:90` - Action callback setup

---

## See Also

- [MESSAGES.md](MESSAGES.md) - Action format in responses
- [SYSTEM.md](SYSTEM.md) - Overall architecture
- [AbletonOSC GitHub](https://github.com/ideoforms/AbletonOSC) - Full command reference
