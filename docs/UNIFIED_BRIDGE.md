# Unified Ableton Bridge

TypeScript-based unified control bridge for ClaudeVST. Provides delta-optimized Ableton control via MCP (for Claude Code) and REST API (for C++ VST adapter).

## Why Unified Bridge?

The original architecture had fragmented control:
- **Python MCP Server** - Full device control via TCP
- **C++ OSCClient** - Legacy transport control via AbletonOSC
- **No delta updates** - Every query returned full state (token waste)

The Unified Bridge solves these issues:
- **Single TypeScript server** exposing both MCP and REST
- **Delta caching** - 85-95% token reduction on repeated queries
- **C++ adapter** for non-blocking VST integration

## Architecture

```
┌─────────────────────────────────────┐
│ Claude Code                          │
│ (MCP Client - stdio)                 │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│ Unified Bridge (TypeScript)          │
│ ├── MCP Server (stdio)               │
│ ├── REST API (http://localhost:8080) │
│ └── Delta Cache                      │
└───────────────┬─────────────────────┘
                │ TCP (localhost:9877)
┌───────────────▼─────────────────────┐
│ Ableton Remote Script (Python)       │
│ (Must be Python - Ableton API req)   │
└─────────────────────────────────────┘
```

## Quick Start

```bash
cd companions/unified-bridge

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in MCP mode (for Claude Code)
npm run start:mcp

# Run in REST API mode (for C++ VST)
npm run start:rest

# Run both modes simultaneously
npm run start:both
```

## Delta Caching

The key feature of the Unified Bridge is delta caching, which dramatically reduces token usage.

### How It Works

1. **First call** - Returns full state, caches it
2. **Subsequent calls** - Returns only changes since last call
3. **No changes** - Returns minimal "no_change" response

### Token Savings

| Query Type | Full State | Delta (no change) | Delta (with change) | Savings |
|------------|------------|-------------------|---------------------|---------|
| Session info | ~2000 tokens | ~50 tokens | ~80 tokens | 96-97% |
| Track info | ~800 tokens | ~30 tokens | ~50 tokens | 94-96% |
| Device params | ~1500 tokens | ~40 tokens | ~100 tokens | 93-97% |

### Example

```bash
# First call - returns full state
curl http://localhost:8080/session/delta
# {"type":"full","state":{"tempo":128,...},"hash":"abc123"}

# Second call - no changes
curl http://localhost:8080/session/delta
# {"type":"no_change","hash":"abc123"}

# Change tempo in Ableton, then call again
curl http://localhost:8080/session/delta
# {"type":"delta","changes":[{"path":"tempo","old_value":128,"new_value":130}]}
```

## MCP Tools

### Delta-Optimized (Recommended)

| Tool | Description |
|------|-------------|
| `get_session_delta` | Session info with caching |
| `get_track_delta` | Track info with caching |
| `get_device_delta` | Device parameters with caching |

### Full State (When Needed)

| Tool | Description |
|------|-------------|
| `get_session_info` | Full session state |
| `get_track_info` | Full track state |
| `get_device_parameters` | Full device parameters |

### Control

| Tool | Description |
|------|-------------|
| `set_device_parameter` | Set a device parameter value |
| `create_midi_track` | Create new MIDI track |
| `create_clip` | Create MIDI clip |
| `add_notes_to_clip` | Add notes to clip |
| `fire_clip` / `stop_clip` | Clip transport |
| `start_playback` / `stop_playback` | Session transport |
| `set_tempo` | Set session tempo |
| `load_instrument_or_effect` | Load from browser |

### Parameter Search

| Tool | Description |
|------|-------------|
| `get_parameter_by_name` | Find parameters by name (case-insensitive) |
| `get_parameters_by_prefix` | Get parameters starting with prefix |

### Return & Master Tracks

| Tool | Description |
|------|-------------|
| `get_return_tracks` | Get all return tracks with devices |
| `get_master_track` | Get master track with devices |

### Batch Operations

| Tool | Description |
|------|-------------|
| `set_parameters_batch` | Set multiple parameters at once |

### Device Presets

| Tool | Description |
|------|-------------|
| `load_device_preset` | Apply preset to device |
| `list_device_presets` | List available presets |

#### Available Presets

**Granulator:**
- `small_grains` - Tight, stuttery grains for glitch textures
- `large_clouds` - Ambient, pad-like clouds
- `rhythmic_chop` - Synced rhythmic chopping

**Wavetable:**
- `warm_pad` - Smooth, warm pad sound
- `aggressive_lead` - Cutting lead sound

**Auto Filter:**
- `slow_sweep` - Slow filter sweep
- `wobble_bass` - Classic dubstep wobble

### Cache Management

| Tool | Description |
|------|-------------|
| `reset_delta_cache` | Force full state on next query |
| `get_cache_stats` | View cache statistics |

### Coaching Tools

| Tool | Description |
|------|-------------|
| `diagnose_sound_issue` | Match symptoms to diagnostic patterns and fixes |
| `analyze_track_chain` | Audit device chain for common issues |
| `compare_to_target` | Compare mix to techno production targets |

## REST API Endpoints

### Session
```
GET  /health                    - Health check & connection status
GET  /session/info              - Full session state
GET  /session/delta             - Delta session state
```

### Tracks
```
GET  /track/:idx/info           - Full track info
GET  /track/:idx/delta          - Delta track info
POST /track/:idx/name           - Set track name
POST /track/create              - Create MIDI track
```

### Devices
```
GET  /track/:t/device/:d/parameters  - Full device params
GET  /track/:t/device/:d/delta       - Delta device params
POST /track/:t/device/:d/parameter/:p - Set parameter
```

### Clips
```
POST /track/:t/clip/:c/create   - Create clip
POST /track/:t/clip/:c/notes    - Add notes
POST /track/:t/clip/:c/fire     - Fire clip
POST /track/:t/clip/:c/stop     - Stop clip
```

### Transport
```
POST /transport/tempo           - Set tempo {"tempo": 128}
POST /transport/play            - Start playback
POST /transport/stop            - Stop playback
```

### Browser
```
GET  /browser/tree              - Get browser categories
GET  /browser/items?path=...    - Get items at path
POST /track/:t/load             - Load instrument {"uri": "..."}
```

### Parameter Search
```
GET  /track/:t/device/:d/parameter-by-name?name=filter  - Find params by name
```

### Return & Master Tracks
```
GET  /return-tracks             - Get all return tracks
GET  /master-track              - Get master track with devices
```

### Batch Operations
```
POST /track/:t/device/:d/parameters-batch  - Set multiple params {"Filter Freq": 0.5}
```

### Device Presets
```
GET  /presets                   - List all device presets
GET  /presets/:deviceType       - List presets for device type
POST /track/:t/device/:d/preset - Apply preset {"device_type": "granulator", "preset_name": "small_grains"}
```

### Cache
```
POST /cache/reset               - Reset cache {"scope": "all"}
GET  /cache/stats               - Get cache statistics
```

### Coaching
```
POST /coaching/diagnose          - Diagnose sound issue {"symptom": "kick muddy"}
GET  /coaching/analyze/:track    - Analyze track device chain
POST /coaching/compare-target    - Compare to techno targets {"analysis": {...}}
```

## C++ VST Adapter

The `UnifiedControlAdapter` class provides non-blocking access from the VST plugin.

### Header (`src/UnifiedControlAdapter.h`)

```cpp
class UnifiedControlAdapter {
public:
    // Connection
    bool isConnected() const;
    void checkConnection();

    // Non-blocking cached state access (safe for audio thread)
    juce::var getCachedSession() const;
    juce::var getCachedTrack(int trackIndex) const;
    juce::var getCachedDevice(int trackIndex, int deviceIndex) const;

    // Async delta queries with callbacks
    void fetchSessionDelta(ResponseCallback callback);
    void fetchTrackDelta(int trackIndex, ResponseCallback callback);
    void fetchDeviceDelta(int trackIndex, int deviceIndex, ResponseCallback callback);

    // Control commands (fire-and-forget)
    void setParameter(int trackIndex, int deviceIndex, int paramIndex, float value);
    void setTempo(float bpm);
    void startPlayback();
    void stopPlayback();
};
```

### Usage in Plugin

```cpp
// In PluginProcessor
auto& adapter = processor.getUnifiedAdapter();

// Non-blocking read (from message thread timer)
adapter.fetchSessionDelta([this](const juce::var& result, bool success) {
    if (success && result["type"] == "delta") {
        // Handle changes
        auto changes = result["changes"];
        // Update UI...
    }
});

// Fire-and-forget control
adapter.setTempo(128.0f);
adapter.startPlayback();
```

## Configuration

### MCP Configuration (`.mcp.json`)

```json
{
  "mcpServers": {
    "ableton-unified": {
      "command": "node",
      "args": [
        "/Users/mk/c/ClaudeVST/companions/unified-bridge/dist/index.js"
      ],
      "env": {
        "MODE": "mcp"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `mcp` | Server mode: `mcp`, `rest`, or `both` |
| `REST_PORT` | `8080` | REST API port |

## File Structure

```
companions/unified-bridge/
├── src/
│   ├── index.ts           # Main entry point
│   ├── mcp-server.ts      # MCP server (stdio)
│   ├── rest-api.ts        # REST API (Fastify)
│   ├── ableton-client.ts  # TCP client to Remote Script
│   ├── delta-cache.ts     # Delta caching logic
│   └── device-presets.ts  # Preset definitions
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Bridge won't connect

1. Make sure Ableton is running
2. Check Remote Script is enabled: Preferences → Link Tempo MIDI → Control Surface
3. Verify port 9877 is not blocked

### "Unknown command" errors

The Remote Script in Ableton is outdated. Reinstall it:

```bash
cp -r companions/ableton-mcp-extended/AbletonMCP_Remote_Script \
      "/Users/mk/Library/Preferences/Ableton/Live 12.1.5/User Remote Scripts/"
```

Then restart Ableton and re-enable the Control Surface.

### Port 8080 already in use

```bash
# Find and kill process using port 8080
lsof -ti :8080 | xargs kill -9
```

### Delta always returns "full"

Cache may be corrupted. Reset it:
```bash
curl -X POST http://localhost:8080/cache/reset
```

## See Also

- [ABLETON_MCP.md](ABLETON_MCP.md) - Original Python MCP server documentation
- [SYSTEM.md](SYSTEM.md) - Overall ClaudeVST architecture
- [VST.md](VST.md) - VST plugin build instructions

---

*Last updated: January 17, 2026*
