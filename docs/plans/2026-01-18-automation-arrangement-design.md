# Automation & Arrangement View Expansion

**Date:** 2026-01-18
**Status:** Approved

## Overview

Add automation curve support and arrangement view manipulation to the Ableton control system. This enables full track production workflow: create clips in session view, automate parameters, paint clips into arrangement.

## New Tools

### Automation (3 tools)

| Tool | Parameters | Returns |
|------|------------|---------|
| `get_clip_automation` | track_index, clip_index | List of available envelopes with parameter info |
| `add_automation_point` | track_index, clip_index, device_index, param_index, time, value | {success, point_count} |
| `clear_automation` | track_index, clip_index, device_index, param_index | {success} |

**Data format:** Point-based breakpoints
```json
{"time": 0.0, "value": 0.2}
{"time": 4.0, "value": 0.8}
{"time": 8.0, "value": 0.2}
```

### Arrangement View (4 tools)

| Tool | Parameters | Returns |
|------|------------|---------|
| `get_arrangement_clips` | track_index | List of arrangement clips with position/length |
| `place_clip_in_arrangement` | track_index, clip_index, start_bar, end_bar | {success, arrangement_clip_index} |
| `delete_arrangement_clip` | track_index, arrangement_clip_index | {success} |
| `set_arrangement_loop` | start_bar, end_bar, enabled | {success} |

## LOM Implementation Notes

### Automation
```python
clip = track.clip_slots[clip_index].clip
# Get automation envelope for a device parameter
device = track.devices[device_index]
param = device.parameters[param_index]
envelope = clip.automation_envelope(param)

# Add breakpoint
envelope.insert_step(time, value)

# Clear all points
envelope.clear_all()
```

### Arrangement
```python
# Access arrangement clips
arrangement_clips = track.arrangement_clips

# Place session clip in arrangement
# Option 1: Duplicate with position
clip_slot = track.clip_slots[clip_index]
clip_slot.duplicate_clip_to(track.arrangement_clips)  # May need different approach

# Option 2: Create new arrangement clip and copy content
# song.view.detail_clip = clip
# track.create_clip(start_time, length)  # Creates in arrangement

# Set loop brace
song.loop_start = start_beats
song.loop_length = length_beats
song.loop = enabled
```

## Implementation Tasks

1. **Remote Script handlers** - Add 7 Python methods
2. **Command dispatch** - Route new commands
3. **MCP tool definitions** - Add to unified-bridge
4. **Integration test** - Verify all tools work

## Out of Scope

- Real-time session-to-arrangement recording
- Audio track arrangement (MIDI only)
- Complex automation curves (bezier, etc.)
- Automation on arrangement clips (session clips only)

## Success Criteria

Can execute this workflow entirely via MCP:
1. Create MIDI clips in session view (existing)
2. Add filter sweep automation to a clip
3. Paint clips into arrangement at specific bars
4. Set loop brace around a section
5. Play back the arrangement
