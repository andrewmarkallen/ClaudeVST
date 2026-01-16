#!/usr/bin/env python3
"""
Teacher MCP API - High-level helpers for Teacher to control Ableton via MCP Extended.

This module provides convenient methods for common music production tasks,
specifically designed for hypnotic techno production (BCCO style).

Usage:
    These functions are designed to be called by the Teacher agent or any
    Claude Code session with access to the ableton-mcp-extended MCP tools.

    Example workflow:
        1. Teacher receives: "Create a hypnotic bassline in F"
        2. Teacher calls: create_bassline("F", "rolling", 4)
        3. MCP tools handle the actual Ableton communication

Note: This module documents patterns for MCP tool usage. The actual MCP calls
must be made by Claude Code using the available MCP tools.
"""

import json
from typing import Dict, List, Optional, Tuple, Any

# =============================================================================
# MIDI Note Reference
# =============================================================================
# Standard MIDI note numbers for common root notes
MIDI_NOTES = {
    "C": 36, "C#": 37, "Db": 37,
    "D": 38, "D#": 39, "Eb": 39,
    "E": 40, "F": 41, "F#": 42, "Gb": 42,
    "G": 43, "G#": 44, "Ab": 44,
    "A": 45, "A#": 46, "Bb": 46,
    "B": 47
}

# Octave offset (MIDI note 36 = C1, 48 = C2, etc.)
def note_to_midi(note: str, octave: int = 1) -> int:
    """
    Convert a note name to MIDI number.

    Args:
        note: Note name like "C", "F#", "Bb"
        octave: Octave number (1 = bass range, 2 = mid-bass)

    Returns:
        MIDI note number

    Example:
        >>> note_to_midi("F", 1)
        41
        >>> note_to_midi("A", 2)
        57
    """
    base = MIDI_NOTES.get(note.upper().replace("B", "b").replace("#", "#"), 36)
    return base + (octave - 1) * 12


# =============================================================================
# Bassline Patterns
# =============================================================================

def get_bassline_pattern(pattern_type: str, root_note: int, length_bars: int = 4) -> List[Dict]:
    """
    Generate MIDI notes for a hypnotic techno bassline pattern.

    Args:
        pattern_type: One of "rolling", "driving", "minimal", "syncopated"
        root_note: MIDI note number for the root (e.g., 41 for F1)
        length_bars: Number of bars (default 4)

    Returns:
        List of note dicts ready for add_notes_to_clip MCP tool

    Pattern descriptions:
        - rolling: Classic rolling bassline, 16th notes with subtle variations
        - driving: Steady 8th notes with octave emphasis on downbeats
        - minimal: Sparse pattern with long notes and space
        - syncopated: Off-beat accents for groove
    """
    notes = []
    beats_per_bar = 4
    total_beats = length_bars * beats_per_bar

    if pattern_type == "rolling":
        # 16th note rolling pattern - quintessential hypnotic techno
        # Pattern: root, root, fifth down, root (repeating with variations)
        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            # 16 sixteenth notes per bar
            for i in range(16):
                start_time = bar_start + (i * 0.25)
                # Pattern variation every 4 sixteenths
                if i % 4 == 0:
                    pitch = root_note
                    velocity = 100
                elif i % 4 == 2:
                    pitch = root_note - 5  # Fourth below
                    velocity = 80
                else:
                    pitch = root_note
                    velocity = 70 + (i % 4) * 5

                notes.append({
                    "pitch": pitch,
                    "start_time": start_time,
                    "duration": 0.2,  # Slightly shorter than 16th for punch
                    "velocity": velocity,
                    "mute": False
                })

    elif pattern_type == "driving":
        # Driving 8th note pattern with octave emphasis
        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for i in range(8):
                start_time = bar_start + (i * 0.5)
                # Octave up on downbeats (1 and 3)
                if i % 4 == 0:
                    pitch = root_note + 12
                    velocity = 110
                else:
                    pitch = root_note
                    velocity = 85

                notes.append({
                    "pitch": pitch,
                    "start_time": start_time,
                    "duration": 0.4,
                    "velocity": velocity,
                    "mute": False
                })

    elif pattern_type == "minimal":
        # Minimal pattern - long notes with strategic placement
        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            # Long root on beat 1
            notes.append({
                "pitch": root_note,
                "start_time": bar_start,
                "duration": 1.5,
                "velocity": 100,
                "mute": False
            })
            # Short accent on beat 3.5
            notes.append({
                "pitch": root_note,
                "start_time": bar_start + 2.5,
                "duration": 0.25,
                "velocity": 85,
                "mute": False
            })

    elif pattern_type == "syncopated":
        # Syncopated pattern for groove
        # Emphasizes off-beats and creates tension
        syncopation = [0, 0.75, 1.5, 2.25, 3.0, 3.5]  # Positions in bar
        velocities = [100, 75, 90, 70, 95, 80]

        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for i, pos in enumerate(syncopation):
                notes.append({
                    "pitch": root_note if i % 2 == 0 else root_note - 5,
                    "start_time": bar_start + pos,
                    "duration": 0.3,
                    "velocity": velocities[i],
                    "mute": False
                })

    else:
        # Default: simple quarter notes
        for beat in range(total_beats):
            notes.append({
                "pitch": root_note,
                "start_time": float(beat),
                "duration": 0.8,
                "velocity": 90,
                "mute": False
            })

    return notes


def get_bassline_instructions(root_note: str, pattern_type: str, length_bars: int) -> str:
    """
    Generate instructions for Teacher to create a bassline using MCP tools.

    This returns a string describing the MCP calls needed.
    Teacher should use this to guide their MCP tool calls.
    """
    midi_note = note_to_midi(root_note, 1)
    notes = get_bassline_pattern(pattern_type, midi_note, length_bars)

    return f"""
To create a {pattern_type} bassline in {root_note}:

1. Create or select a MIDI track for bass
2. Load a bass instrument (recommended URIs):
   - Operator: "query:Synths#Operator:Bass:FileId_75651" (Basic Sub Sine - clean)
   - Operator: "query:Synths#Operator:Bass:FileId_77364" (Acid Bass - gritty)
   - Operator: "query:Synths#Operator:Bass:FileId_42737" (Deep FM Bounce - hypnotic)

3. Create a {length_bars * 4}-beat clip:
   - Use: create_clip(track_index, clip_index, {length_bars * 4})

4. Add the pattern notes:
   - {len(notes)} notes total
   - Root note: {midi_note} ({root_note}1)

5. Name the clip "{pattern_type.title()} Bass {root_note}"

Pattern characteristics for '{pattern_type}':
{_get_pattern_description(pattern_type)}
"""


def _get_pattern_description(pattern_type: str) -> str:
    """Get human-readable pattern description."""
    descriptions = {
        "rolling": "- 16th note pattern with root/fourth alternation\n- Hypnotic, repetitive feel\n- Velocity variations for movement",
        "driving": "- 8th note pattern with octave emphasis\n- Strong downbeat energy\n- Good for building intensity",
        "minimal": "- Sparse, long notes with space\n- Creates tension through absence\n- Good for breakdowns",
        "syncopated": "- Off-beat accents\n- Creates groove and swing\n- Good for adding funk"
    }
    return descriptions.get(pattern_type, "- Standard quarter note pattern")


# =============================================================================
# Kick Patterns
# =============================================================================

def get_kick_pattern(style: str, length_bars: int = 4) -> List[Dict]:
    """
    Generate MIDI notes for a kick drum pattern.

    Args:
        style: One of "four_on_floor", "syncopated", "broken", "minimal"
        length_bars: Number of bars

    Returns:
        List of note dicts for add_notes_to_clip

    Note: Standard kick MIDI note is 36 (C1) for most drum racks.
    """
    KICK_NOTE = 36  # Standard kick in most drum racks
    notes = []
    beats_per_bar = 4

    if style == "four_on_floor":
        # Classic techno 4-on-floor
        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for beat in range(4):
                notes.append({
                    "pitch": KICK_NOTE,
                    "start_time": bar_start + beat,
                    "duration": 0.5,
                    "velocity": 110 if beat == 0 else 100,
                    "mute": False
                })

    elif style == "syncopated":
        # Syncopated kick with off-beat accents
        pattern = [0, 0.75, 1.5, 2.0, 2.75, 3.5]  # Positions in bar
        velocities = [110, 80, 95, 100, 75, 90]

        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for i, pos in enumerate(pattern):
                notes.append({
                    "pitch": KICK_NOTE,
                    "start_time": bar_start + pos,
                    "duration": 0.3,
                    "velocity": velocities[i],
                    "mute": False
                })

    elif style == "broken":
        # Broken beat style - good for creating tension
        pattern = [0, 1.25, 2.5, 3.25]
        velocities = [110, 85, 100, 90]

        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for i, pos in enumerate(pattern):
                notes.append({
                    "pitch": KICK_NOTE,
                    "start_time": bar_start + pos,
                    "duration": 0.35,
                    "velocity": velocities[i],
                    "mute": False
                })

    elif style == "minimal":
        # Minimal - just beats 1 and 3
        for bar in range(length_bars):
            bar_start = bar * beats_per_bar
            for beat in [0, 2]:
                notes.append({
                    "pitch": KICK_NOTE,
                    "start_time": bar_start + beat,
                    "duration": 0.5,
                    "velocity": 105,
                    "mute": False
                })

    else:
        # Default to four on floor
        return get_kick_pattern("four_on_floor", length_bars)

    return notes


def get_kick_instructions(style: str, length_bars: int) -> str:
    """Generate instructions for creating a kick pattern."""
    notes = get_kick_pattern(style, length_bars)

    return f"""
To create a {style} kick pattern:

1. Create or select a MIDI track for drums
2. Load a drum instrument:
   - DS Kick: "query:Synths#DS%20Kick" (simple, punchy)
   - Drum Rack for full kit (see Drums browser)

3. Create a {length_bars * 4}-beat clip

4. Add kick notes:
   - {len(notes)} hits total
   - Kick note: 36 (C1)

5. Name the clip "{style.replace('_', ' ').title()} Kick"

Style characteristics for '{style}':
{_get_kick_style_description(style)}
"""


def _get_kick_style_description(style: str) -> str:
    """Get human-readable kick style description."""
    descriptions = {
        "four_on_floor": "- Kick on every beat\n- Classic techno foundation\n- Steady, driving pulse",
        "syncopated": "- Off-beat accents\n- More groove and movement\n- Works well with rolling bass",
        "broken": "- Irregular pattern\n- Creates tension and interest\n- Good for buildups/breakdowns",
        "minimal": "- Only beats 1 and 3\n- Creates space\n- Half-time feel"
    }
    return descriptions.get(style, "- Standard pattern")


# =============================================================================
# Instrument Loading
# =============================================================================

# Common instrument URIs for hypnotic techno production
INSTRUMENT_URIS = {
    # Bass instruments (Operator - FM synthesis, great for techno)
    "bass_sub_sine": "query:Synths#Operator:Bass:FileId_75651",  # Basic Sub Sine
    "bass_acid": "query:Synths#Operator:Bass:FileId_77364",       # Acid Bass
    "bass_deep_fm": "query:Synths#Operator:Bass:FileId_42737",    # Deep FM Bounce
    "bass_house": "query:Synths#Operator:Bass:FileId_77382",      # House Bass
    "bass_reese": "query:Synths#Operator:Bass:FileId_75707",      # Reese Odyssey

    # Kick drums
    "kick_ds": "query:Synths#DS%20Kick",                          # Drum Synth Kick
    "kick_808": "query:Synths#Operator:Bass:FileId_13278",        # More Than 808 Bass

    # Pads (for atmosphere)
    "pad_operator": "query:Synths#Operator:Pad",                  # Operator Pad folder

    # Leads (sparingly in hypnotic techno)
    "lead_operator": "query:Synths#Operator:Synth%20Lead",        # Operator Lead folder

    # Basic instruments
    "operator": "query:Synths#Operator",                          # Default Operator
    "wavetable": "query:Synths#Wavetable",                        # Default Wavetable
    "drift": "query:Synths#Drift",                                # Drift synth
}


def get_instrument_uri(instrument_type: str) -> Optional[str]:
    """
    Get the browser URI for a given instrument type.

    Args:
        instrument_type: Short name like "bass_sub_sine", "kick_ds", etc.

    Returns:
        URI string for use with load_instrument_or_effect MCP tool
    """
    return INSTRUMENT_URIS.get(instrument_type.lower())


def get_load_instrument_instructions(track_index: int, instrument_type: str) -> str:
    """Generate instructions for loading an instrument."""
    uri = get_instrument_uri(instrument_type)

    if not uri:
        available = ", ".join(INSTRUMENT_URIS.keys())
        return f"""
Unknown instrument type: {instrument_type}
Available types: {available}

To browse for instruments, use:
- get_browser_tree("instruments")
- get_browser_items_at_path("Instruments/Operator/Bass")
"""

    return f"""
To load {instrument_type} on track {track_index}:

Use the MCP tool:
    load_instrument_or_effect(track_index={track_index}, uri="{uri}")

This will load the instrument and you can verify with get_track_info({track_index}).
"""


# =============================================================================
# Mix Overview
# =============================================================================

def parse_session_info(session_json: str) -> Dict[str, Any]:
    """
    Parse session info JSON into a readable format.

    Args:
        session_json: JSON string from get_session_info MCP tool

    Returns:
        Dict with parsed session data
    """
    try:
        data = json.loads(session_json)
        return {
            "tempo": data.get("tempo", 120),
            "time_signature": f"{data.get('signature_numerator', 4)}/{data.get('signature_denominator', 4)}",
            "track_count": data.get("track_count", 0),
            "return_count": data.get("return_track_count", 0),
            "master": data.get("master_track", {})
        }
    except json.JSONDecodeError:
        return {"error": "Failed to parse session info"}


def parse_track_info(track_json: str) -> Dict[str, Any]:
    """
    Parse track info JSON into a readable format with volume in dB.

    Args:
        track_json: JSON string from get_track_info MCP tool

    Returns:
        Dict with parsed track data including dB volume
    """
    try:
        data = json.loads(track_json)

        # Convert Ableton's 0-1 volume to dB (approximate)
        volume_linear = data.get("volume", 0.85)
        if volume_linear > 0:
            import math
            volume_db = 20 * math.log10(volume_linear)
        else:
            volume_db = -float('inf')

        return {
            "name": data.get("name", "Unknown"),
            "index": data.get("index", -1),
            "type": "MIDI" if data.get("is_midi_track") else "Audio",
            "volume_db": round(volume_db, 1),
            "volume_linear": volume_linear,
            "panning": data.get("panning", 0),
            "muted": data.get("mute", False),
            "soloed": data.get("solo", False),
            "armed": data.get("arm", False),
            "clip_count": sum(1 for slot in data.get("clip_slots", []) if slot.get("has_clip")),
            "device_count": len(data.get("devices", []))
        }
    except json.JSONDecodeError:
        return {"error": "Failed to parse track info"}


def get_mix_overview_instructions() -> str:
    """Generate instructions for getting a mix overview."""
    return """
To get a mix overview:

1. Get session info:
   session = get_session_info()

2. For each track (0 to track_count-1):
   track = get_track_info(track_index)

3. Summarize the mix:
   - List all tracks with names and volumes
   - Note which are muted/soloed
   - Check master track level
   - Report tempo and time signature

Example summary format:
"Mix Overview at 128 BPM (4/4):
- Track 0 'Kick': -6.0 dB
- Track 1 'Bass': -8.5 dB
- Track 2 'Hats': -12.0 dB (muted)
- Master: -3.0 dB"
"""


# =============================================================================
# Volume Control
# =============================================================================

def db_to_linear(db: float) -> float:
    """
    Convert dB to linear gain (0-1 scale for Ableton).

    Args:
        db: Volume in decibels (-inf to +6 typical range)

    Returns:
        Linear gain value (0.0 to ~2.0)

    Note: Ableton uses ~0.85 as unity (0 dB).
    """
    import math
    if db <= -70:  # Treat as silence
        return 0.0
    return 10 ** (db / 20)


def linear_to_db(linear: float) -> float:
    """
    Convert linear gain to dB.

    Args:
        linear: Linear gain value (0.0 to ~2.0)

    Returns:
        Volume in decibels
    """
    import math
    if linear <= 0:
        return -float('inf')
    return 20 * math.log10(linear)


def get_set_volume_instructions(track_index: int, volume_db: float) -> str:
    """
    Generate instructions for setting track volume.

    Note: Ableton's track volume is controlled via device parameters
    or requires direct track manipulation. The current MCP tools
    don't have a direct set_volume function, but this documents
    the intended approach.
    """
    linear = db_to_linear(volume_db)

    return f"""
To set track {track_index} volume to {volume_db} dB:

Current MCP limitation: No direct set_track_volume tool available.

Workaround options:
1. Manual adjustment in Ableton
2. Use a Utility device with gain control
3. Request this feature for MCP Extended

Target linear value: {linear:.4f}
(Unity gain / 0 dB = ~0.85 in Ableton's scale)

For reference:
- -6 dB = {db_to_linear(-6):.4f}
- 0 dB = {db_to_linear(0):.4f}
- +3 dB = {db_to_linear(3):.4f}
"""


# =============================================================================
# Complete Workflow Examples
# =============================================================================

WORKFLOW_EXAMPLES = """
# Teacher MCP API - Complete Workflow Examples

## Example 1: Create a Basic Hypnotic Techno Beat

```python
# 1. Set tempo to classic techno range
set_tempo(128)

# 2. Create kick track
create_midi_track()  # Creates track at end
track_index = 0  # Adjust based on actual index
set_track_name(track_index, "Kick")

# 3. Load kick instrument
load_instrument_or_effect(track_index, "query:Synths#DS%20Kick")

# 4. Create clip and add 4-on-floor pattern
create_clip(track_index, 0, 16)  # 4 bars
kick_notes = get_kick_pattern("four_on_floor", 4)
add_notes_to_clip(track_index, 0, kick_notes)
set_clip_name(track_index, 0, "Four on Floor")

# 5. Create bass track
create_midi_track()
bass_track = 1
set_track_name(bass_track, "Bass")

# 6. Load bass instrument
load_instrument_or_effect(bass_track, "query:Synths#Operator:Bass:FileId_75651")

# 7. Create rolling bassline
create_clip(bass_track, 0, 16)
bass_notes = get_bassline_pattern("rolling", note_to_midi("F", 1), 4)
add_notes_to_clip(bass_track, 0, bass_notes)
set_clip_name(bass_track, 0, "Rolling Bass F")

# 8. Fire clips to preview
fire_clip(track_index, 0)
fire_clip(bass_track, 0)
```

## Example 2: Check Mix and Adjust

```python
# 1. Get session overview
session = get_session_info()
print(f"Session at {session['tempo']} BPM with {session['track_count']} tracks")

# 2. Check each track
for i in range(session['track_count']):
    track = get_track_info(i)
    volume_db = linear_to_db(track['volume'])
    print(f"Track {i} '{track['name']}': {volume_db:.1f} dB")

# 3. Note any issues
# - Tracks peaking above -6 dB may need reduction
# - Muted tracks might be forgotten
# - Check for solo'd tracks affecting balance
```

## BCCO Style Tips

1. **Tempo**: 126-130 BPM (sweet spot: 127-128)
2. **Kick**: Punchy but not overly loud (-8 to -6 dB)
3. **Bass**: Rolling patterns in F, G, or A minor
4. **Hats**: Minimal, often just off-beats
5. **Atmosphere**: Subtle pads with long release
6. **Dynamics**: Use automation for subtle builds
7. **Space**: Don't fill every frequency - leave room
"""


def print_help():
    """Print module help and examples."""
    print(__doc__)
    print(WORKFLOW_EXAMPLES)


if __name__ == "__main__":
    print_help()
