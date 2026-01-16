# Unified Bridge Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add parameter-by-name lookup, return/master track support, batch operations, and device presets to the unified bridge.

**Architecture:** Extend existing TypeScript unified-bridge and Python Remote Script with new commands. No new services needed - all enhancements build on the working delta-cached infrastructure.

**Tech Stack:** TypeScript (unified-bridge), Python (Ableton Remote Script)

---

## Task 1: Parameter-by-Name Lookup in Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Write the command handler**

Add to `__init__.py` after existing command handlers:

```python
def _get_parameter_by_name(self, track_index, device_index, param_name):
    """Find parameters by name (case-insensitive contains match)"""
    try:
        track = self._get_track(track_index)
        if not track:
            return {"error": f"Track {track_index} not found"}

        if device_index >= len(track.devices):
            return {"error": f"Device {device_index} not found on track {track_index}"}

        device = track.devices[device_index]
        matches = []

        for idx, param in enumerate(device.parameters):
            if param_name.lower() in param.name.lower():
                matches.append({
                    "index": idx,
                    "name": param.name,
                    "value": param.value,
                    "min": param.min,
                    "max": param.max,
                    "is_quantized": param.is_quantized
                })

        return {"matches": matches, "device_name": device.name}
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Register the command in _handle_command**

Add to the command dispatch dictionary:

```python
elif cmd_type == "get_parameter_by_name":
    return self._get_parameter_by_name(
        params.get("track_index"),
        params.get("device_index"),
        params.get("param_name")
    )
```

**Step 3: Test manually**

Send via TCP to port 9877:
```json
{"type": "get_parameter_by_name", "params": {"track_index": 0, "device_index": 0, "param_name": "cutoff"}}
```

Expected: List of parameters containing "cutoff" in their name.

**Step 4: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): add parameter-by-name lookup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Return Tracks & Master Track in Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add return tracks handler**

```python
def _get_return_tracks(self):
    """Get info for all return tracks"""
    try:
        return_tracks = []
        for idx, track in enumerate(self._song.return_tracks):
            return_tracks.append({
                "index": idx,
                "name": track.name,
                "volume": track.mixer_device.volume.value,
                "panning": track.mixer_device.panning.value,
                "mute": track.mute,
                "solo": track.solo,
                "devices": [{"name": d.name, "class_name": d.class_name} for d in track.devices]
            })
        return {"return_tracks": return_tracks}
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add master track handler**

```python
def _get_master_track(self):
    """Get master track details"""
    try:
        master = self._song.master_track
        return {
            "name": master.name,
            "volume": master.mixer_device.volume.value,
            "panning": master.mixer_device.panning.value,
            "devices": [{
                "name": d.name,
                "class_name": d.class_name,
                "parameters": [{"name": p.name, "value": p.value} for p in d.parameters[:10]]
            } for d in master.devices]
        }
    except Exception as e:
        return {"error": str(e)}
```

**Step 3: Register commands**

```python
elif cmd_type == "get_return_tracks":
    return self._get_return_tracks()
elif cmd_type == "get_master_track":
    return self._get_master_track()
```

**Step 4: Test manually**

```json
{"type": "get_return_tracks", "params": {}}
{"type": "get_master_track", "params": {}}
```

**Step 5: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): add return tracks and master track support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Batch Parameter Operations in Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add batch get by prefix**

```python
def _get_parameters_by_prefix(self, track_index, device_index, prefix):
    """Get all parameters starting with prefix"""
    try:
        track = self._get_track(track_index)
        device = track.devices[device_index]
        matches = []

        for idx, param in enumerate(device.parameters):
            if param.name.lower().startswith(prefix.lower()):
                matches.append({
                    "index": idx,
                    "name": param.name,
                    "value": param.value,
                    "min": param.min,
                    "max": param.max
                })

        return {"matches": matches}
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add batch set**

```python
def _set_parameters_batch(self, track_index, device_index, param_values):
    """Set multiple parameters at once. param_values: {"Filter Cutoff": 0.7, "Resonance": 0.3}"""
    try:
        track = self._get_track(track_index)
        device = track.devices[device_index]
        results = []

        # Build name -> param mapping
        param_map = {p.name.lower(): p for p in device.parameters}

        for name, value in param_values.items():
            param = param_map.get(name.lower())
            if param:
                param.value = value
                results.append({"name": name, "status": "set", "value": value})
            else:
                results.append({"name": name, "status": "not_found"})

        return {"results": results}
    except Exception as e:
        return {"error": str(e)}
```

**Step 3: Register commands**

```python
elif cmd_type == "get_parameters_by_prefix":
    return self._get_parameters_by_prefix(
        params.get("track_index"),
        params.get("device_index"),
        params.get("prefix")
    )
elif cmd_type == "set_parameters_batch":
    return self._set_parameters_batch(
        params.get("track_index"),
        params.get("device_index"),
        params.get("param_values")
    )
```

**Step 4: Test batch set**

```json
{"type": "set_parameters_batch", "params": {"track_index": 0, "device_index": 0, "param_values": {"Filter Freq": 0.5, "Filter Res": 0.3}}}
```

**Step 5: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): add batch parameter operations

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Expose New Commands in TypeScript Bridge

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts`
- Modify: `companions/unified-bridge/src/rest-api.ts`

**Step 1: Add MCP tools for new commands**

Add to `mcp-server.ts`:

```typescript
server.tool('get_parameter_by_name', 'Find device parameters by name', {
  track_index: { type: 'number', description: 'Track index' },
  device_index: { type: 'number', description: 'Device index' },
  param_name: { type: 'string', description: 'Parameter name to search for' }
}, async ({ track_index, device_index, param_name }) => {
  const result = await client.sendCommand('get_parameter_by_name', {
    track_index, device_index, param_name
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_return_tracks', 'Get all return tracks with devices', {}, async () => {
  const result = await client.sendCommand('get_return_tracks', {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('get_master_track', 'Get master track with devices', {}, async () => {
  const result = await client.sendCommand('get_master_track', {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.tool('set_parameters_batch', 'Set multiple parameters at once', {
  track_index: { type: 'number', description: 'Track index' },
  device_index: { type: 'number', description: 'Device index' },
  param_values: { type: 'object', description: 'Object mapping param names to values' }
}, async ({ track_index, device_index, param_values }) => {
  const result = await client.sendCommand('set_parameters_batch', {
    track_index, device_index, param_values
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
```

**Step 2: Add REST API endpoints**

Add to `rest-api.ts`:

```typescript
// Parameter by name
this.app.get<{ Params: { trackIndex: string; deviceIndex: string }; Querystring: { name: string } }>(
  '/track/:trackIndex/device/:deviceIndex/parameter-by-name',
  async (request) => {
    const trackIndex = parseInt(request.params.trackIndex, 10);
    const deviceIndex = parseInt(request.params.deviceIndex, 10);
    const paramName = request.query.name;
    return await this.client.sendCommand('get_parameter_by_name', {
      track_index: trackIndex,
      device_index: deviceIndex,
      param_name: paramName
    });
  }
);

// Return tracks
this.app.get('/return-tracks', async () => {
  return await this.client.sendCommand('get_return_tracks', {});
});

// Master track
this.app.get('/master-track', async () => {
  return await this.client.sendCommand('get_master_track', {});
});

// Batch parameter set
this.app.post<{ Params: { trackIndex: string; deviceIndex: string }; Body: Record<string, number> }>(
  '/track/:trackIndex/device/:deviceIndex/parameters-batch',
  async (request) => {
    const trackIndex = parseInt(request.params.trackIndex, 10);
    const deviceIndex = parseInt(request.params.deviceIndex, 10);
    return await this.client.sendCommand('set_parameters_batch', {
      track_index: trackIndex,
      device_index: deviceIndex,
      param_values: request.body
    });
  }
);
```

**Step 3: Build TypeScript**

Run: `cd companions/unified-bridge && npm run build`
Expected: No errors

**Step 4: Test via REST**

```bash
curl "http://localhost:8080/track/0/device/0/parameter-by-name?name=filter"
curl http://localhost:8080/return-tracks
curl http://localhost:8080/master-track
curl -X POST http://localhost:8080/track/0/device/0/parameters-batch -H "Content-Type: application/json" -d '{"Filter Freq": 0.5}'
```

**Step 5: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts companions/unified-bridge/src/rest-api.ts
git commit -m "feat(unified-bridge): expose parameter-by-name, return/master tracks, batch ops

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Device Presets Module

**Files:**
- Create: `companions/unified-bridge/src/device-presets.ts`
- Modify: `companions/unified-bridge/src/mcp-server.ts`
- Modify: `companions/unified-bridge/src/rest-api.ts`

**Step 1: Create presets file**

Create `companions/unified-bridge/src/device-presets.ts`:

```typescript
export interface DevicePreset {
  name: string;
  description: string;
  parameters: Record<string, number>;
}

export interface DevicePresets {
  [deviceType: string]: {
    [presetName: string]: DevicePreset;
  };
}

export const DEVICE_PRESETS: DevicePresets = {
  granulator: {
    small_grains: {
      name: "Small Grains",
      description: "Tight, stuttery grains for glitch textures",
      parameters: {
        "Grain Size": 0.1,
        "Spray": 0.2,
        "Frequency": 0.5,
        "Random Pitch": 0.1
      }
    },
    large_clouds: {
      name: "Large Clouds",
      description: "Ambient, pad-like clouds",
      parameters: {
        "Grain Size": 0.8,
        "Spray": 0.7,
        "Frequency": 0.3,
        "Random Pitch": 0.4
      }
    },
    rhythmic_chop: {
      name: "Rhythmic Chop",
      description: "Synced rhythmic chopping",
      parameters: {
        "Grain Size": 0.25,
        "Spray": 0.1,
        "Frequency": 0.75,
        "Random Pitch": 0.0
      }
    }
  },
  wavetable: {
    warm_pad: {
      name: "Warm Pad",
      description: "Smooth, warm pad sound",
      parameters: {
        "Filter Freq": 0.4,
        "Filter Res": 0.2,
        "Filter Type": 0.0,
        "Sub Osc": 0.3
      }
    },
    aggressive_lead: {
      name: "Aggressive Lead",
      description: "Cutting lead sound",
      parameters: {
        "Filter Freq": 0.7,
        "Filter Res": 0.6,
        "Filter Type": 0.5,
        "Sub Osc": 0.0
      }
    }
  },
  autofilter: {
    slow_sweep: {
      name: "Slow Sweep",
      description: "Slow filter sweep",
      parameters: {
        "Frequency": 0.3,
        "Resonance": 0.4,
        "LFO Amount": 0.6,
        "LFO Rate": 0.2
      }
    },
    wobble_bass: {
      name: "Wobble Bass",
      description: "Classic dubstep wobble",
      parameters: {
        "Frequency": 0.5,
        "Resonance": 0.7,
        "LFO Amount": 0.8,
        "LFO Rate": 0.5
      }
    }
  }
};

export function getPreset(deviceType: string, presetName: string): DevicePreset | null {
  const devicePresets = DEVICE_PRESETS[deviceType.toLowerCase()];
  if (!devicePresets) return null;
  return devicePresets[presetName.toLowerCase()] || null;
}

export function listPresets(deviceType?: string): string[] {
  if (deviceType) {
    const presets = DEVICE_PRESETS[deviceType.toLowerCase()];
    return presets ? Object.keys(presets) : [];
  }
  return Object.keys(DEVICE_PRESETS);
}
```

**Step 2: Add MCP tool for presets**

Add to `mcp-server.ts`:

```typescript
import { getPreset, listPresets, DEVICE_PRESETS } from './device-presets';

server.tool('load_device_preset', 'Apply a preset to a device', {
  track_index: { type: 'number', description: 'Track index' },
  device_index: { type: 'number', description: 'Device index' },
  device_type: { type: 'string', description: 'Device type (granulator, wavetable, autofilter)' },
  preset_name: { type: 'string', description: 'Preset name' }
}, async ({ track_index, device_index, device_type, preset_name }) => {
  const preset = getPreset(device_type, preset_name);
  if (!preset) {
    return { content: [{ type: 'text', text: `Preset not found: ${device_type}/${preset_name}` }] };
  }

  const result = await client.sendCommand('set_parameters_batch', {
    track_index,
    device_index,
    param_values: preset.parameters
  });

  return { content: [{ type: 'text', text: `Applied ${preset.name}: ${preset.description}\n${JSON.stringify(result, null, 2)}` }] };
});

server.tool('list_device_presets', 'List available presets', {
  device_type: { type: 'string', description: 'Device type (optional)' }
}, async ({ device_type }) => {
  if (device_type) {
    const presets = listPresets(device_type);
    return { content: [{ type: 'text', text: `Presets for ${device_type}: ${presets.join(', ')}` }] };
  }
  return { content: [{ type: 'text', text: `Device types: ${Object.keys(DEVICE_PRESETS).join(', ')}` }] };
});
```

**Step 3: Add REST endpoints**

Add to `rest-api.ts`:

```typescript
import { getPreset, listPresets, DEVICE_PRESETS } from './device-presets';

// List presets
this.app.get('/presets', async () => {
  return DEVICE_PRESETS;
});

this.app.get<{ Params: { deviceType: string } }>('/presets/:deviceType', async (request) => {
  const presets = DEVICE_PRESETS[request.params.deviceType.toLowerCase()];
  return presets || { error: 'Device type not found' };
});

// Apply preset
this.app.post<{
  Params: { trackIndex: string; deviceIndex: string };
  Body: { device_type: string; preset_name: string }
}>('/track/:trackIndex/device/:deviceIndex/preset', async (request) => {
  const trackIndex = parseInt(request.params.trackIndex, 10);
  const deviceIndex = parseInt(request.params.deviceIndex, 10);
  const { device_type, preset_name } = request.body;

  const preset = getPreset(device_type, preset_name);
  if (!preset) {
    return { error: `Preset not found: ${device_type}/${preset_name}` };
  }

  return await this.client.sendCommand('set_parameters_batch', {
    track_index: trackIndex,
    device_index: deviceIndex,
    param_values: preset.parameters
  });
});
```

**Step 4: Build and test**

```bash
cd companions/unified-bridge && npm run build
curl http://localhost:8080/presets
curl -X POST http://localhost:8080/track/0/device/0/preset -H "Content-Type: application/json" -d '{"device_type": "granulator", "preset_name": "small_grains"}'
```

**Step 5: Commit**

```bash
git add companions/unified-bridge/src/device-presets.ts companions/unified-bridge/src/mcp-server.ts companions/unified-bridge/src/rest-api.ts
git commit -m "feat(unified-bridge): add device presets for granulator, wavetable, autofilter

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `docs/UNIFIED_BRIDGE.md`

**Step 1: Add new tools to documentation**

Add to the MCP Tools section:

```markdown
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
```

**Step 2: Add new REST endpoints**

Add to REST API section:

```markdown
### Parameter Search
```
GET  /track/:t/device/:d/parameter-by-name?name=filter
```

### Return & Master Tracks
```
GET  /return-tracks
GET  /master-track
```

### Batch Operations
```
POST /track/:t/device/:d/parameters-batch  - Body: {"Filter Freq": 0.5, "Resonance": 0.3}
```

### Presets
```
GET  /presets                              - List all device presets
GET  /presets/:deviceType                  - List presets for device type
POST /track/:t/device/:d/preset            - Body: {"device_type": "granulator", "preset_name": "small_grains"}
```
```

**Step 3: Commit**

```bash
git add docs/UNIFIED_BRIDGE.md
git commit -m "docs: add new unified bridge tools to documentation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Copy Updated Remote Script to Ableton

**Step 1: Copy script**

```bash
cp -r companions/ableton-mcp-extended/AbletonMCP_Remote_Script \
      "/Users/mk/Library/Preferences/Ableton/Live 12.1.5/User Remote Scripts/"
```

**Step 2: Reload in Ableton**

In Ableton: Preferences → Link Tempo MIDI → Set AbletonMCP_Remote_Script to "None" then back to selected input.

Or restart Ableton if hot reload doesn't work.

**Step 3: Verify**

```bash
# Test new commands
curl "http://localhost:8080/track/0/device/0/parameter-by-name?name=filter"
curl http://localhost:8080/return-tracks
```

---

## Verification Checklist

After all tasks complete:

- [ ] `get_parameter_by_name` returns matching parameters
- [ ] `get_return_tracks` shows all return tracks
- [ ] `get_master_track` shows master track with devices
- [ ] `set_parameters_batch` sets multiple params in one call
- [ ] `load_device_preset` applies preset parameters
- [ ] `list_device_presets` shows available presets
- [ ] All REST endpoints respond correctly
- [ ] Documentation is complete
- [ ] Remote Script is deployed to Ableton

---

## Future Enhancements (Not in Scope)

- Phase 3: VST-hosted control server
- More device presets (Serum, Operator, Analog)
- Preset import/export to JSON files
- UI for preset management in VST
