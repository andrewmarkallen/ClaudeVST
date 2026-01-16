# Ableton Control Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mixing controls, clip/track duplication, and effects loading to the unified-bridge MCP server.

**Architecture:** The unified-bridge TypeScript MCP server sends JSON commands over TCP to a Python Remote Script running inside Ableton Live. We'll add new command handlers to both sides: Python handlers in the Remote Script, and MCP tool definitions in the TypeScript server.

**Tech Stack:** Python (Ableton Remote Script), TypeScript (MCP Server), Ableton Live Object Model (LOM)

---

## Task 1: Add Track Mixer Controls to Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py:229-233` (add to command list)
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py:296` (add handlers in main_thread_task)

**Step 1: Add commands to the main thread command list**

Find line ~229 and add the new commands:

```python
            elif command_type in ["create_midi_track", "set_track_name",
                                 "create_clip", "add_notes_to_clip", "set_clip_name",
                                 "set_tempo", "fire_clip", "stop_clip",
                                 "start_playback", "stop_playback", "load_browser_item",
                                 "set_device_parameter", "set_parameters_batch",
                                 "set_track_volume", "set_track_panning", "set_track_mute",
                                 "set_track_solo", "set_track_send",
                                 "duplicate_clip", "duplicate_track", "duplicate_scene",
                                 "load_instrument_or_effect"]:
```

**Step 2: Add handler dispatch in main_thread_task (after line ~296)**

```python
                        elif command_type == "set_track_volume":
                            result = self._set_track_volume(params.get("track_index", 0), params.get("volume", 0.85))
                        elif command_type == "set_track_panning":
                            result = self._set_track_panning(params.get("track_index", 0), params.get("panning", 0.0))
                        elif command_type == "set_track_mute":
                            result = self._set_track_mute(params.get("track_index", 0), params.get("mute", False))
                        elif command_type == "set_track_solo":
                            result = self._set_track_solo(params.get("track_index", 0), params.get("solo", False))
                        elif command_type == "set_track_send":
                            result = self._set_track_send(params.get("track_index", 0), params.get("send_index", 0), params.get("value", 0.0))
                        elif command_type == "duplicate_clip":
                            result = self._duplicate_clip(params.get("track_index", 0), params.get("clip_index", 0), params.get("target_track_index"), params.get("target_clip_index"))
                        elif command_type == "duplicate_track":
                            result = self._duplicate_track(params.get("track_index", 0))
                        elif command_type == "duplicate_scene":
                            result = self._duplicate_scene(params.get("scene_index", 0))
```

**Step 3: Verify the edit compiles**

Run: Reload Ableton project or check Live's log for syntax errors.
Expected: No errors on load.

**Step 4: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): add command dispatch for mixer and duplication commands"
```

---

## Task 2: Implement Mixer Control Methods in Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py` (add after `_set_parameters_batch` method, ~line 882)

**Step 1: Add `_set_track_volume` method**

```python
    def _set_track_volume(self, track_index, volume):
        """Set track volume (0.0 to 1.0, where 0.85 = 0dB)"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            track = self._song.tracks[track_index]
            # Clamp volume to valid range (0.0 to 1.0)
            clamped_volume = max(0.0, min(1.0, volume))
            track.mixer_device.volume.value = clamped_volume

            return {
                "track_index": track_index,
                "volume": track.mixer_device.volume.value
            }
        except Exception as e:
            self.log_message("Error setting track volume: " + str(e))
            return {"error": str(e)}
```

**Step 2: Add `_set_track_panning` method**

```python
    def _set_track_panning(self, track_index, panning):
        """Set track panning (-1.0 = left, 0.0 = center, 1.0 = right)"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            track = self._song.tracks[track_index]
            # Clamp panning to valid range (-1.0 to 1.0)
            clamped_panning = max(-1.0, min(1.0, panning))
            track.mixer_device.panning.value = clamped_panning

            return {
                "track_index": track_index,
                "panning": track.mixer_device.panning.value
            }
        except Exception as e:
            self.log_message("Error setting track panning: " + str(e))
            return {"error": str(e)}
```

**Step 3: Add `_set_track_mute` and `_set_track_solo` methods**

```python
    def _set_track_mute(self, track_index, mute):
        """Set track mute state"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            track = self._song.tracks[track_index]
            track.mute = bool(mute)

            return {
                "track_index": track_index,
                "mute": track.mute
            }
        except Exception as e:
            self.log_message("Error setting track mute: " + str(e))
            return {"error": str(e)}

    def _set_track_solo(self, track_index, solo):
        """Set track solo state"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            track = self._song.tracks[track_index]
            track.solo = bool(solo)

            return {
                "track_index": track_index,
                "solo": track.solo
            }
        except Exception as e:
            self.log_message("Error setting track solo: " + str(e))
            return {"error": str(e)}
```

**Step 4: Add `_set_track_send` method**

```python
    def _set_track_send(self, track_index, send_index, value):
        """Set track send level (0.0 to 1.0)"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            track = self._song.tracks[track_index]
            sends = track.mixer_device.sends

            if send_index < 0 or send_index >= len(sends):
                return {"error": "Send index out of range (have {0} sends)".format(len(sends))}

            # Clamp value to valid range
            clamped_value = max(0.0, min(1.0, value))
            sends[send_index].value = clamped_value

            return {
                "track_index": track_index,
                "send_index": send_index,
                "value": sends[send_index].value
            }
        except Exception as e:
            self.log_message("Error setting track send: " + str(e))
            return {"error": str(e)}
```

**Step 5: Verify by reloading Ableton**

Run: Reload Ableton project
Expected: No errors in Live's log

**Step 6: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): implement mixer control methods (volume, pan, mute, solo, send)"
```

---

## Task 3: Implement Duplication Methods in Remote Script

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py` (add after mixer methods)

**Step 1: Add `_duplicate_clip` method**

```python
    def _duplicate_clip(self, track_index, clip_index, target_track_index=None, target_clip_index=None):
        """Duplicate a clip to another slot"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Source track index out of range"}

            track = self._song.tracks[track_index]

            if clip_index < 0 or clip_index >= len(track.clip_slots):
                return {"error": "Source clip index out of range"}

            clip_slot = track.clip_slots[clip_index]

            if not clip_slot.has_clip:
                return {"error": "No clip in source slot"}

            # Default target is next slot on same track
            if target_track_index is None:
                target_track_index = track_index
            if target_clip_index is None:
                target_clip_index = clip_index + 1

            if target_track_index < 0 or target_track_index >= len(self._song.tracks):
                return {"error": "Target track index out of range"}

            target_track = self._song.tracks[target_track_index]

            if target_clip_index < 0 or target_clip_index >= len(target_track.clip_slots):
                return {"error": "Target clip index out of range"}

            target_slot = target_track.clip_slots[target_clip_index]

            if target_slot.has_clip:
                return {"error": "Target slot already has a clip"}

            # Duplicate the clip
            clip_slot.duplicate_clip_to(target_slot)

            return {
                "source_track": track_index,
                "source_clip": clip_index,
                "target_track": target_track_index,
                "target_clip": target_clip_index,
                "duplicated": True
            }
        except Exception as e:
            self.log_message("Error duplicating clip: " + str(e))
            return {"error": str(e)}
```

**Step 2: Add `_duplicate_track` method**

```python
    def _duplicate_track(self, track_index):
        """Duplicate a track"""
        try:
            if track_index < 0 or track_index >= len(self._song.tracks):
                return {"error": "Track index out of range"}

            # Duplicate the track
            self._song.duplicate_track(track_index)

            # New track is inserted after the original
            new_track_index = track_index + 1
            new_track = self._song.tracks[new_track_index]

            return {
                "original_track": track_index,
                "new_track_index": new_track_index,
                "new_track_name": new_track.name
            }
        except Exception as e:
            self.log_message("Error duplicating track: " + str(e))
            return {"error": str(e)}
```

**Step 3: Add `_duplicate_scene` method**

```python
    def _duplicate_scene(self, scene_index):
        """Duplicate a scene"""
        try:
            if scene_index < 0 or scene_index >= len(self._song.scenes):
                return {"error": "Scene index out of range"}

            # Duplicate the scene
            self._song.duplicate_scene(scene_index)

            # New scene is inserted after the original
            new_scene_index = scene_index + 1
            new_scene = self._song.scenes[new_scene_index]

            return {
                "original_scene": scene_index,
                "new_scene_index": new_scene_index,
                "new_scene_name": new_scene.name
            }
        except Exception as e:
            self.log_message("Error duplicating scene: " + str(e))
            return {"error": str(e)}
```

**Step 4: Commit**

```bash
git add companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py
git commit -m "feat(remote-script): implement duplication methods (clip, track, scene)"
```

---

## Task 4: Add MCP Tool Definitions for Mixer Controls

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts:120-145` (after set_track_name tool)

**Step 1: Add mixer control tool definitions**

Add after the `set_track_name` tool definition (~line 145):

```typescript
        // Mixer controls
        {
          name: 'set_track_volume',
          description: 'Set track volume (0.0 to 1.0, where 0.85 = 0dB)',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              volume: { type: 'number', description: 'Volume level (0.0 to 1.0, default 0.85 = 0dB)' },
            },
            required: ['track_index', 'volume'],
          },
        },
        {
          name: 'set_track_panning',
          description: 'Set track panning (-1.0 = left, 0.0 = center, 1.0 = right)',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              panning: { type: 'number', description: 'Pan position (-1.0 to 1.0)' },
            },
            required: ['track_index', 'panning'],
          },
        },
        {
          name: 'set_track_mute',
          description: 'Set track mute state',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              mute: { type: 'boolean', description: 'Mute state (true/false)' },
            },
            required: ['track_index', 'mute'],
          },
        },
        {
          name: 'set_track_solo',
          description: 'Set track solo state',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              solo: { type: 'boolean', description: 'Solo state (true/false)' },
            },
            required: ['track_index', 'solo'],
          },
        },
        {
          name: 'set_track_send',
          description: 'Set track send level to a return track',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              send_index: { type: 'number', description: 'Index of the send (0 = Send A, 1 = Send B, etc.)' },
              value: { type: 'number', description: 'Send level (0.0 to 1.0)' },
            },
            required: ['track_index', 'send_index', 'value'],
          },
        },
```

**Step 2: Build and verify**

Run: `cd companions/unified-bridge && npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts
git commit -m "feat(mcp-server): add mixer control tool definitions"
```

---

## Task 5: Add MCP Tool Definitions for Duplication

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts` (after mixer tools)

**Step 1: Add duplication tool definitions**

```typescript
        // Duplication
        {
          name: 'duplicate_clip',
          description: 'Duplicate a clip to another slot',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Source track index' },
              clip_index: { type: 'number', description: 'Source clip slot index' },
              target_track_index: { type: 'number', description: 'Target track index (default: same track)' },
              target_clip_index: { type: 'number', description: 'Target clip slot index (default: next slot)' },
            },
            required: ['track_index', 'clip_index'],
          },
        },
        {
          name: 'duplicate_track',
          description: 'Duplicate an entire track with all clips and devices',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of track to duplicate' },
            },
            required: ['track_index'],
          },
        },
        {
          name: 'duplicate_scene',
          description: 'Duplicate a scene (row of clips)',
          inputSchema: {
            type: 'object',
            properties: {
              scene_index: { type: 'number', description: 'Index of scene to duplicate' },
            },
            required: ['scene_index'],
          },
        },
```

**Step 2: Build and verify**

Run: `cd companions/unified-bridge && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts
git commit -m "feat(mcp-server): add duplication tool definitions"
```

---

## Task 6: Add Effect Loading Tool Definition

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts` (find existing load_instrument_or_effect or add it)

**Step 1: Verify load_instrument_or_effect exists or add it**

The tool definition should already exist around line 265-275. If not, add:

```typescript
        {
          name: 'load_instrument_or_effect',
          description: 'Load an instrument or effect onto a track by browser URI',
          inputSchema: {
            type: 'object',
            properties: {
              track_index: { type: 'number', description: 'Index of the track' },
              uri: { type: 'string', description: 'Browser item URI (e.g., "query:AudioFx#Compressor")' },
            },
            required: ['track_index', 'uri'],
          },
        },
```

**Step 2: Add handler if needed**

The MCP server passes through unknown commands to Ableton. Check if `load_instrument_or_effect` is already handled in the Remote Script (it is at line 278-281). No additional handler needed.

**Step 3: Build and verify**

Run: `cd companions/unified-bridge && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts
git commit -m "feat(mcp-server): ensure load_instrument_or_effect tool is defined"
```

---

## Task 7: Install Updated Remote Script

**Files:**
- Copy: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/` to `~/Music/Ableton/User Library/Remote Scripts/AbletonMCP/`

**Step 1: Copy the updated Remote Script**

```bash
cp -r companions/ableton-mcp-extended/AbletonMCP_Remote_Script/* ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonMCP/
```

**Step 2: Restart Ableton or reload the control surface**

In Ableton: Preferences -> Link/Tempo/MIDI -> Control Surface -> Set to "None" then back to "AbletonMCP"

**Step 3: Verify connection**

Run: Test MCP command via Claude Code
Expected: `get_session_info` returns session data

**Step 4: Commit docs update**

```bash
git add CLAUDE.md
git commit -m "docs: document new mixer and duplication controls"
```

---

## Task 8: Integration Test - Full Feature Verification

**Step 1: Test mixer controls**

```
# In Claude Code, test:
mcp__ableton-unified__set_track_volume track_index=0 volume=0.5
mcp__ableton-unified__set_track_panning track_index=0 panning=-0.5
mcp__ableton-unified__set_track_mute track_index=0 mute=true
mcp__ableton-unified__set_track_solo track_index=0 solo=true
mcp__ableton-unified__set_track_send track_index=0 send_index=0 value=0.7
```

Expected: Each command returns success, Ableton UI reflects changes

**Step 2: Test duplication**

```
# Create a clip first, then:
mcp__ableton-unified__duplicate_clip track_index=0 clip_index=0
mcp__ableton-unified__duplicate_track track_index=0
mcp__ableton-unified__duplicate_scene scene_index=0
```

Expected: Clips, tracks, scenes are duplicated in Ableton

**Step 3: Test effect loading**

```
mcp__ableton-unified__load_instrument_or_effect track_index=0 uri="query:AudioFx#Compressor"
mcp__ableton-unified__load_instrument_or_effect track_index=0 uri="query:AudioFx#Reverb"
```

Expected: Effects appear on the track's device chain

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete ableton control expansion (mixer, duplication, effects)

- Add set_track_volume, set_track_panning, set_track_mute, set_track_solo, set_track_send
- Add duplicate_clip, duplicate_track, duplicate_scene
- Expose load_instrument_or_effect in unified-bridge
- All commands tested and working

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary of New Capabilities

| Tool | Purpose |
|------|---------|
| `set_track_volume` | Set track fader level |
| `set_track_panning` | Set track pan position |
| `set_track_mute` | Mute/unmute track |
| `set_track_solo` | Solo/unsolo track |
| `set_track_send` | Set send level to return track |
| `duplicate_clip` | Copy clip to another slot |
| `duplicate_track` | Duplicate entire track |
| `duplicate_scene` | Duplicate scene row |
| `load_instrument_or_effect` | Load effects from browser |

## What's Still Missing (Future Work)

1. **Arrangement View** - Would need `create_arrangement_clip`, `get_arrangement_clips`
2. **Automation** - Would need `add_automation_point`, `get_automation_envelope`
3. **Audio Export** - Not possible via LOM, would need AppleScript/keyboard shortcuts
