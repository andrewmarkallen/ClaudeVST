# Ableton Unified Bridge

TypeScript-based unified control bridge for ClaudeVST. Provides delta-optimized Ableton control via both MCP (for Claude Code) and REST API (for C++ VST adapter).

## Features

- **Delta Caching**: 85-95% token reduction on repeated queries
- **MCP Server**: stdio interface for Claude Code integration
- **REST API**: HTTP endpoints for C++ VST adapter
- **Full Ableton Control**: Sessions, tracks, devices, clips, transport, browser

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in MCP mode (for Claude Code)
npm run start:mcp

# Run in REST API mode (for C++ VST)
npm run start:rest

# Run both modes
npm run start:both
```

## MCP Tools

### Delta-Optimized (Recommended)
- `get_session_delta` - Session info with delta caching
- `get_track_delta` - Track info with delta caching
- `get_device_delta` - Device parameters with delta caching

### Full State
- `get_session_info` - Full session state
- `get_track_info` - Full track state
- `get_device_parameters` - Full device parameters

### Control
- `set_device_parameter` - Set a device parameter
- `create_midi_track` - Create MIDI track
- `create_clip` - Create MIDI clip
- `add_notes_to_clip` - Add notes to clip
- `fire_clip` / `stop_clip` - Clip control
- `start_playback` / `stop_playback` - Transport
- `set_tempo` - Tempo control
- `load_instrument_or_effect` - Load from browser

### Cache Management
- `reset_delta_cache` - Force full state on next query
- `get_cache_stats` - View cache statistics

## REST API Endpoints

```
GET  /health                           - Health check
GET  /session/info                     - Full session
GET  /session/delta                    - Delta session
GET  /track/:idx/info                  - Full track info
GET  /track/:idx/delta                 - Delta track info
GET  /track/:t/device/:d/parameters    - Full device params
GET  /track/:t/device/:d/delta         - Delta device params
POST /track/:t/device/:d/parameter/:p  - Set parameter
POST /transport/tempo                  - Set tempo
POST /transport/play                   - Start playback
POST /transport/stop                   - Stop playback
POST /cache/reset                      - Reset cache
GET  /cache/stats                      - Cache statistics
```

## Token Savings Example

```
Full session: ~2000 tokens
Delta (no change): ~50 tokens
Delta (tempo changed): ~80 tokens
Savings: 96-97%
```

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

## Configuration

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "ableton-unified": {
      "command": "node",
      "args": ["companions/unified-bridge/dist/index.js"],
      "env": {
        "MODE": "mcp"
      }
    }
  }
}
```

## Requirements

- Node.js 20+
- Ableton Live with Remote Script running (TCP port 9877)
