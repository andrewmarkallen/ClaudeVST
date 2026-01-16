# Research Report: Reading Ableton Live Device Parameters

**Date:** January 17, 2026
**Purpose:** Investigate solutions for autonomously reading Ableton Live device parameters (EQ settings, compressor thresholds, reverb settings, etc.) to enable the Teacher Agent use case.

---

## Executive Summary

Reading device parameters from Ableton Live is **fully possible** through multiple approaches. The Ableton Live Object Model (LOM) exposes all device parameters, and several implementations already exist. The most viable approaches for our MCP architecture are:

1. **AbletonOSC** - Already provides complete device parameter API (RECOMMENDED)
2. **Extend ableton-mcp-extended** - Add device parameter commands to existing Remote Script
3. **LiveGrabber Max for Live** - Pre-built parameter monitoring solution

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Approach 1: AbletonOSC Integration](#approach-1-abletonosc-integration)
3. [Approach 2: Extend ableton-mcp-extended](#approach-2-extend-ableton-mcp-extended)
4. [Approach 3: Max for Live Solutions](#approach-3-max-for-live-solutions)
5. [Approach 4: PyLive Framework](#approach-4-pylive-framework)
6. [Approach 5: ClyphX Pro](#approach-5-clyphx-pro)
7. [Live Object Model Reference](#live-object-model-reference)
8. [Recommendations](#recommendations)
9. [Implementation Plan](#implementation-plan)

---

## Current State Analysis

### What ableton-mcp-extended Currently Supports

The existing implementation (`/companions/ableton-mcp-extended/`) provides:

- Session info (tempo, time signature, track count)
- Track info (name, volume, pan, mute, solo, arm)
- Device listing per track (name, class_name, type)
- Browser navigation and instrument loading
- Clip creation and MIDI note manipulation
- Playback control

### What's Missing

The current implementation **does NOT** support:

- Reading device parameter values (e.g., EQ frequency, gain, Q)
- Reading device parameter names
- Reading parameter min/max ranges
- Setting device parameter values
- Listening for parameter changes

### Root Cause

The `_get_track_info()` method in `AbletonMCP_Remote_Script/__init__.py` only extracts basic device metadata:

```python
# Current implementation (lines 389-397)
devices = []
for device_index, device in enumerate(track.devices):
    devices.append({
        "index": device_index,
        "name": device.name,
        "class_name": device.class_name,
        "type": self._get_device_type(device)
    })
```

The LOM provides `device.parameters` which is not being accessed.

---

## Approach 1: AbletonOSC Integration

**Feasibility: HIGH | Effort: LOW | Recommended: YES**

### Overview

[AbletonOSC](https://github.com/ideoforms/AbletonOSC) is a mature MIDI Remote Script that exposes the entire Live Object Model via OSC. It already implements comprehensive device parameter reading.

### Device Parameter OSC Addresses

| OSC Address | Parameters | Returns |
|-------------|------------|---------|
| `/live/device/get/name` | track_id, device_id | track_id, device_id, name |
| `/live/device/get/class_name` | track_id, device_id | track_id, device_id, class_name |
| `/live/device/get/type` | track_id, device_id | track_id, device_id, type (1=audio_effect, 2=instrument, 4=midi_effect) |
| `/live/device/get/num_parameters` | track_id, device_id | track_id, device_id, num_parameters |
| `/live/device/get/parameters/name` | track_id, device_id | track_id, device_id, [name, ...] |
| `/live/device/get/parameters/value` | track_id, device_id | track_id, device_id, [value, ...] |
| `/live/device/get/parameters/min` | track_id, device_id | track_id, device_id, [min, ...] |
| `/live/device/get/parameters/max` | track_id, device_id | track_id, device_id, [max, ...] |
| `/live/device/get/parameters/is_quantized` | track_id, device_id | track_id, device_id, [bool, ...] |
| `/live/device/get/parameter/value` | track_id, device_id, param_id | track_id, device_id, param_id, value |
| `/live/device/get/parameter/value_string` | track_id, device_id, param_id | track_id, device_id, param_id, string |
| `/live/device/set/parameter/value` | track_id, device_id, param_id, value | (none) |
| `/live/device/set/parameters/value` | track_id, device_id, value, value... | (none) |

### Parameter Change Listeners

```
/live/device/start_listen/parameter/value <track_id> <device_id> <param_id>
/live/device/stop_listen/parameter/value <track_id> <device_id> <param_id>
```

### Connection Details

- **Listen port:** 11000
- **Reply port:** 11001
- **Protocol:** UDP

### Integration Options

**Option A: Replace ableton-mcp-extended with AbletonOSC**
- Use AbletonOSC as the Remote Script
- Modify MCP Server to send OSC instead of TCP socket

**Option B: Hybrid Approach**
- Keep ableton-mcp-extended for session/track/clip operations
- Add AbletonOSC for device parameter operations
- Run both Remote Scripts simultaneously

**Option C: Port AbletonOSC parameter code to ableton-mcp-extended**
- Study AbletonOSC implementation
- Add equivalent TCP commands to our Remote Script

### Pros
- Complete, tested implementation
- Active maintenance
- Comprehensive documentation
- Supports wildcards for batch queries

### Cons
- Requires running additional Remote Script (if hybrid)
- OSC protocol instead of TCP (minor complexity)
- Would need to bridge OSC to MCP

---

## Approach 2: Extend ableton-mcp-extended

**Feasibility: HIGH | Effort: MEDIUM | Recommended: YES (Alternative)**

### Overview

Add device parameter commands directly to our existing Remote Script. This is straightforward since the LOM access is already set up.

### Required Changes to Remote Script

Add new command handlers in `AbletonMCP_Remote_Script/__init__.py`:

```python
def _get_device_parameters(self, track_index, device_index):
    """Get all parameters for a device"""
    try:
        if track_index < 0 or track_index >= len(self._song.tracks):
            raise IndexError("Track index out of range")

        track = self._song.tracks[track_index]

        if device_index < 0 or device_index >= len(track.devices):
            raise IndexError("Device index out of range")

        device = track.devices[device_index]

        parameters = []
        for param_index, param in enumerate(device.parameters):
            parameters.append({
                "index": param_index,
                "name": param.name,
                "value": param.value,
                "min": param.min,
                "max": param.max,
                "is_quantized": param.is_quantized,
                "value_string": str(param)  # Human-readable value
            })

        return {
            "device_name": device.name,
            "device_class": device.class_name,
            "parameter_count": len(parameters),
            "parameters": parameters
        }
    except Exception as e:
        self.log_message("Error getting device parameters: " + str(e))
        raise

def _set_device_parameter(self, track_index, device_index, param_index, value):
    """Set a device parameter value"""
    try:
        if track_index < 0 or track_index >= len(self._song.tracks):
            raise IndexError("Track index out of range")

        track = self._song.tracks[track_index]

        if device_index < 0 or device_index >= len(track.devices):
            raise IndexError("Device index out of range")

        device = track.devices[device_index]

        if param_index < 0 or param_index >= len(device.parameters):
            raise IndexError("Parameter index out of range")

        param = device.parameters[param_index]

        # Clamp value to valid range
        clamped_value = max(param.min, min(param.max, value))
        param.value = clamped_value

        return {
            "parameter_name": param.name,
            "new_value": param.value,
            "value_string": str(param)
        }
    except Exception as e:
        self.log_message("Error setting device parameter: " + str(e))
        raise
```

### Required Changes to MCP Server

Add new MCP tools in `MCP_Server/server.py`:

```python
@mcp.tool()
def get_device_parameters(ctx: Context, track_index: int, device_index: int) -> str:
    """
    Get all parameters for a device on a track.

    Parameters:
    - track_index: The index of the track containing the device
    - device_index: The index of the device on the track

    Returns detailed information about each parameter including name, value, min, max.
    """
    try:
        ableton = get_ableton_connection()
        result = ableton.send_command("get_device_parameters", {
            "track_index": track_index,
            "device_index": device_index
        })
        return json.dumps(result, indent=2)
    except Exception as e:
        logger.error(f"Error getting device parameters: {str(e)}")
        return f"Error getting device parameters: {str(e)}"

@mcp.tool()
def set_device_parameter(ctx: Context, track_index: int, device_index: int,
                         param_index: int, value: float) -> str:
    """
    Set a device parameter value.

    Parameters:
    - track_index: The index of the track containing the device
    - device_index: The index of the device on the track
    - param_index: The index of the parameter to set
    - value: The new value for the parameter
    """
    try:
        ableton = get_ableton_connection()
        result = ableton.send_command("set_device_parameter", {
            "track_index": track_index,
            "device_index": device_index,
            "param_index": param_index,
            "value": value
        })
        return f"Set {result.get('parameter_name')} to {result.get('value_string')}"
    except Exception as e:
        logger.error(f"Error setting device parameter: {str(e)}")
        return f"Error setting device parameter: {str(e)}"
```

### Pros
- Maintains single Remote Script architecture
- Direct TCP communication (already implemented)
- Full control over implementation
- No additional dependencies

### Cons
- Requires development and testing
- Need to handle edge cases (locked parameters, etc.)

---

## Approach 3: Max for Live Solutions

**Feasibility: MEDIUM | Effort: LOW | Recommended: NO (for our use case)**

### LiveGrabber

[LiveGrabber](https://support.showsync.com/sync-tools/livegrabber/introduction) is a Max for Live device collection that sends parameter data via OSC.

**Components:**
- **ParamGrabber** - Sends device parameter values via OSC
- **TrackGrabber** - Sends track parameter values via OSC
- **AnalysisGrabber** - Sends audio analysis via OSC
- **GrabberSender** - Central OSC routing
- **GrabberReceiver** - Incoming OSC handling

**Features:**
- Real-time parameter streaming
- Configurable OSC output format (Norm, Raw, String)
- Parameter grouping and filtering

**Limitations:**
- Requires M4L device on each track to monitor
- Manual setup per device
- Not suitable for "discover all parameters" use case

### OSC Mapper

Available on maxforlive.com, provides bidirectional OSC mapping.

### Ableton M4L Connection Kit

Official Ableton pack with OSC send/receive devices. Good for specific parameter mapping but not bulk parameter reading.

### Pros
- No Python development required
- Visual configuration
- Real-time streaming

### Cons
- Requires manual M4L device placement
- Not suitable for autonomous discovery
- Additional complexity in session management

---

## Approach 4: PyLive Framework

**Feasibility: HIGH | Effort: MEDIUM | Recommended: ALTERNATIVE**

### Overview

[PyLive](https://github.com/ideoforms/pylive) is a Python framework for controlling Ableton Live. It uses OSC internally (via AbletonOSC).

### Installation

```bash
pip install pylive
```

### Usage Example

```python
import live

# Connect to Ableton
set = live.Set()
set.scan()

# Get device parameters
track = set.tracks[0]
device = track.devices[0]

for param in device.parameters:
    print(f"{param.name}: {param.value} (range: {param.min}-{param.max})")

# Set parameter
device.parameters[0].value = 0.5
```

### Key Classes

- `live.Set` - Represents the Live session
- `live.Track` - Track with devices
- `live.Device` - Device with parameters
- `live.Parameter` - Individual parameter

### Pros
- Pythonic interface
- Well-documented
- Active community

### Cons
- Requires AbletonOSC as the Remote Script
- Additional dependency
- Separate from our MCP architecture

---

## Approach 5: ClyphX Pro

**Feasibility: MEDIUM | Effort: LOW | Recommended: NO**

### Overview

[ClyphX Pro](https://isotonikstudios.com/product/clyphx-pro/) is a commercial scripting solution for Ableton Live.

### Device Parameter Access

ClyphX Pro can read and write device parameters using action syntax:

```
# Set parameter by name
4/DEV2 "Filter Freq" 0.75

# Set parameter by index
4/DEV2 P1 0.5
```

### Limitations for Our Use Case

- Commercial license required
- Primarily designed for MIDI-triggered actions
- No direct API for external applications
- Would require intermediary mechanism

### Free Alternative: ClyphX 2.6.2

Available on [GitHub](https://github.com/ldrolez/clyphx-live11), open-source but limited features compared to Pro.

---

## Live Object Model Reference

### Device Parameter Hierarchy

```
Song
  └── Track
        └── devices[] (list of Device)
              └── parameters[] (list of DeviceParameter)
                    ├── name (str)
                    ├── value (float)
                    ├── min (float)
                    ├── max (float)
                    ├── is_quantized (bool)
                    ├── is_enabled (bool)
                    └── __str__() → human-readable value
```

### LOM Path Syntax

```
live_set tracks <track_index> devices <device_index> parameters <param_index>
```

### Common Device Parameter Patterns

**EQ Eight:**
- Parameters 0-7: Band 1-8 Frequency
- Parameters 8-15: Band 1-8 Gain
- Parameters 16-23: Band 1-8 Q
- Parameters 24-31: Band 1-8 On/Off

**Compressor:**
- Parameter 0: Threshold
- Parameter 1: Ratio
- Parameter 2: Attack
- Parameter 3: Release
- Parameter 4: Output Gain

**Reverb:**
- Parameters vary by reverb type
- Common: Decay Time, Size, Pre-Delay, Dry/Wet

### Documentation Sources

- [LOM Max 8 Documentation](https://docs.cycling74.com/legacy/max8/vignettes/live_object_model)
- [Structure Void Python API Docs](https://structure-void.com/PythonLiveAPI_documentation/)

---

## Recommendations

### Primary Recommendation: Extend ableton-mcp-extended

**Rationale:**
1. Maintains single Remote Script architecture
2. Uses existing TCP socket communication
3. Full control over implementation
4. No additional dependencies
5. Seamless integration with current MCP tools

**Implementation Priority:**
1. `get_device_parameters` - Read all parameters for a device
2. `set_device_parameter` - Set a single parameter value
3. `get_device_parameter_by_name` - Find parameter by name (convenience)

### Secondary Recommendation: AbletonOSC Integration

If rapid deployment is needed, consider using AbletonOSC alongside our Remote Script:
- More battle-tested parameter handling
- Supports advanced features (listeners, wildcards)
- May introduce complexity managing two Remote Scripts

### Not Recommended

- **Max for Live solutions** - Too manual, not autonomous
- **ClyphX Pro** - Commercial, not API-oriented
- **PyLive alone** - Requires AbletonOSC anyway

---

## Implementation Plan

### Phase 1: Core Parameter Reading (2-3 hours)

1. Add `_get_device_parameters()` to Remote Script
2. Add `get_device_parameters` MCP tool
3. Test with various device types (native, VST, AU)

### Phase 2: Parameter Writing (1-2 hours)

1. Add `_set_device_parameter()` to Remote Script
2. Add `set_device_parameter` MCP tool
3. Add parameter value clamping and validation

### Phase 3: Enhanced Features (2-3 hours)

1. Add `get_device_parameter_by_name` for user-friendly queries
2. Add batch parameter operations
3. Add parameter change detection (polling or listeners)

### Phase 4: Teacher Agent Integration (1-2 hours)

1. Update Teacher Agent to use new parameter tools
2. Create parameter interpretation helpers
3. Test end-to-end with real teaching scenarios

### Estimated Total Effort: 6-10 hours

---

## Code Examples

### Example: Reading EQ Settings

```python
# MCP tool call
result = get_device_parameters(track_index=0, device_index=1)

# Expected response
{
  "device_name": "EQ Eight",
  "device_class": "Eq8",
  "parameter_count": 35,
  "parameters": [
    {"index": 0, "name": "1 Frequency A", "value": 0.37, "min": 0.0, "max": 1.0, "value_string": "100 Hz"},
    {"index": 1, "name": "1 Gain A", "value": 0.5, "min": 0.0, "max": 1.0, "value_string": "0.00 dB"},
    ...
  ]
}
```

### Example: Adjusting Compressor Threshold

```python
# Find the compressor device
track_info = get_track_info(track_index=0)
compressor_index = next(
    d["index"] for d in track_info["devices"]
    if d["class_name"] == "Compressor2"
)

# Read current parameters
params = get_device_parameters(track_index=0, device_index=compressor_index)

# Set threshold (parameter 0)
set_device_parameter(
    track_index=0,
    device_index=compressor_index,
    param_index=0,
    value=0.3  # normalized 0-1
)
```

---

## References

### Primary Sources
- [AbletonOSC GitHub](https://github.com/ideoforms/AbletonOSC)
- [PyLive GitHub](https://github.com/ideoforms/pylive)
- [LiveGrabber Documentation](https://support.showsync.com/sync-tools/livegrabber/introduction)
- [LOM Documentation](https://docs.cycling74.com/legacy/max8/vignettes/live_object_model)

### Secondary Sources
- [ClyphX Pro](https://isotonikstudios.com/product/clyphx-pro/)
- [Structure Void Python API](https://structure-void.com/PythonLiveAPI_documentation/)
- [AbletonOSC Academic Paper](https://nime.org/proceedings/2023/nime2023_60.pdf)

### Community Resources
- [Ableton Forum - Control Surface Scripts](https://forum.ableton.com/)
- [Cycling '74 Max for Live Forum](https://cycling74.com/forums)

---

*Report prepared by Knowledge Researcher Agent*
*ClaudeVST Project - January 2026*
