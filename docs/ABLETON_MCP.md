# Ableton MCP Extended - Teacher Reference

**For:** Teacher Agent (music production tutor)
**Purpose:** Reference for demonstrating concepts using Ableton control
**MCP Server:** `ableton-mcp-extended`

---

## Overview

The Ableton MCP Extended server provides **programmatic control** of Ableton Live through natural language. As Teacher, you can use these capabilities to:
- Demonstrate music production concepts in real-time
- Set up examples ("Let me create a sidechain compression example")
- Generate educational patterns ("Here's what a techno kick pattern looks like")
- Load instruments and presets to show timbral differences

**Important:** Always ask permission before making changes to the user's Ableton session!

---

## Available Capabilities

### 🎵 Session & Transport Control

**What you can do:**
- Start/stop playback
- Get session info (tempo, time signature, track count)
- Set tempo and time signature
- Manage scenes (create, delete, rename, fire)

**Example uses:**
```
"Want me to set the tempo to 128 BPM for a techno groove?"
"Let me create a new scene for this composition section"
"I'll start playback so you can hear the difference"
```

---

### 🎹 Track Management

**What you can do:**
- Create MIDI or audio tracks
- Rename tracks
- Get detailed track information
- Control: volume, pan, mute, solo, arm
- Manage track groups and folding

**Example uses:**
```
"Let me create a MIDI track for your bass line"
"I'll solo this track so you can hear it isolated"
"Want me to organize these into a drum group?"
```

---

### 🎼 MIDI Clip & Note Manipulation

**What you can do:**
- Create MIDI clips with specified lengths
- Add individual notes (pitch, start, duration, velocity)
- Delete, transpose, and quantize notes
- Batch edit multiple notes at once
- Adjust clip loop parameters
- Set follow actions

**Example uses:**
```
"Let me create a 4-bar clip with a basic kick pattern"
"I'll add a C minor triad to show the harmonic foundation"
"Want me to quantize these notes to 1/16th grid?"
"Let me transpose this up an octave"
```

**Note data format:**
- Pitch: MIDI note number (C3 = 60, C4 = 72)
- Start: Position in beats
- Duration: Length in beats
- Velocity: 0-127 (127 = loudest)

---

### 🎛️ Device & Parameter Control

**What you can do:**
- Load instruments and effects from Ableton's browser **by URI**
- Get full parameter lists for any device
- Set individual parameters (0.0 to 1.0 normalized)
- Batch-set multiple parameters

**Special feature: Browser URIs**
- Load **Serum presets by path**!
- Load any Ableton instrument/effect
- Import audio samples

**Example uses:**
```
"Let me load Operator on this track to demonstrate FM synthesis"
"I'll add a compressor and set a 4:1 ratio"
"Want me to load that Serum bass preset?"
"Let me adjust the filter cutoff to brighten this up"
```

---

### 📊 Automation & Envelopes

**What you can do:**
- Add automation points for any device parameter
- Clear automation
- Get information about clip envelopes

**Status:** Experimental (not working perfectly yet)

**Example uses:**
```
"Let me automate the filter sweep across this clip"
"I'll add some volume automation for dynamics"
```

---

### 🔍 Browser Integration

**What you can do:**
- Navigate Ableton's browser
- List available items
- Load instruments/effects/samples by path or URI
- Import audio files into tracks or clips

**Example uses:**
```
"Let me find a kick drum sample for you"
"I'll import this reference track so we can analyze it"
"Want me to load the Analog synth for a classic sound?"
```

---

### 🔊 Audio Import

**What you can do:**
- Import audio files directly into audio tracks
- Place audio in specific clip slots
- Import reference tracks for comparison

**Example uses:**
```
"Let me import your vocal stem into a new audio track"
"I'll add this reference track for A/B comparison"
```

---

## Teacher Best Practices

### 1. Always Ask First
```
❌ "I'll create a track now"
✅ "Want me to create a MIDI track and load Operator to demonstrate FM synthesis?"
```

### 2. Explain What You're Doing
```
"I'm setting the tempo to 128 BPM (typical for techno) and creating a kick
pattern with notes on beats 1, 5, 9, and 13 (four-on-the-floor rhythm)"
```

### 3. Use for Demonstrations, Not Production
- Show concepts, don't build full tracks
- Create small examples (1-2 bars)
- Focus on educational value

### 4. Clean Up After Yourself
```
"Want me to delete this example track now that we've covered the concept?"
```

### 5. Respect User's Session
- Don't modify existing tracks without explicit permission
- Create new tracks for examples
- Ask before changing tempo or transport state

---

## Common Teaching Workflows

### Example 1: Demonstrating Sidechain Compression
```
1. Ask: "Want me to set up a sidechain compression example?"
2. Create two tracks: "Kick" and "Bass"
3. Load kick drum on track 1
4. Load bass synth on track 2
5. Create simple patterns on both
6. Add compressor to bass with sidechain input from kick
7. Explain: "The kick 'ducks' the bass, creating that pumping effect"
8. Play back to demonstrate
```

### Example 2: Showing Chord Progressions
```
1. Ask: "Want me to create a chord progression example in C minor?"
2. Create MIDI track with piano/keys
3. Create 4-bar clip
4. Add notes for: Cm → Ab → Eb → Bb progression
5. Explain: "This is a i-VI-III-VII progression, common in sad/emotional music"
6. Play back
```

### Example 3: Genre-Specific Drums
```
1. Ask: "Want me to show you a basic techno kick pattern?"
2. Create MIDI track with drum rack
3. Load kick sample
4. Create 1-bar clip with kicks on: 1.1, 1.2.3, 1.3.2, 2.1
5. Explain: "Four-on-the-floor with syncopated double kicks"
6. Play back at 128 BPM
```

---

## Limitations

**What you CAN'T do (yet):**
- Record audio/MIDI in real-time
- Directly access mixer sends/returns (use track parameters instead)
- Edit audio clips (only MIDI)
- Access arrangement view automation (clip envelopes only)
- Render/export audio

**Workarounds:**
- For recording: "You can record that manually and I'll help you edit the MIDI"
- For mixer: "Let me adjust the track volume directly"
- For audio editing: "That's best done manually in Ableton's clip view"

---

## Technical Details

**How it works:**
1. Teacher (you) understands user's natural language request
2. You translate to MCP tool calls (handled automatically by Claude)
3. MCP server sends commands to Ableton via Remote Script (TCP port 9877)
4. Ableton executes commands and returns results
5. You interpret results and explain to user

**Connection requirements:**
- Ableton Live must be running
- AbletonMCP Remote Script must be enabled in Preferences
- MCP server must be running (automatic when Claude Code starts)

**Check connection:** If tools aren't working, the Remote Script may not be loaded or Ableton may be closed.

---

## Quick Reference: Common Operations

| Task | Example Prompt |
|------|---------------|
| Create track | "Create a MIDI track called 'Bass'" |
| Load instrument | "Load Operator on track 1" |
| Create clip | "Create a 4-bar MIDI clip in slot 1 on track 2" |
| Add note | "Add a C3 note at beat 1, quarter note length, velocity 100" |
| Set tempo | "Set tempo to 128 BPM" |
| Start playback | "Start playing" |
| Solo track | "Solo track 3" |
| Set parameter | "Set the filter cutoff on track 1's device to 50%" |
| Import audio | "Import 'kick.wav' into a new audio track" |

---

## Genre-Specific Knowledge

### Techno (125-135 BPM)
- Four-on-the-floor kick pattern
- Rolling hi-hats (1/16th or 1/32nd)
- Minimal, repetitive melodic elements
- Heavy use of filters and modulation

### House (120-130 BPM)
- Four-on-the-floor kick
- Open hi-hat on offbeats
- Funky bass lines (root-fifth patterns)
- Piano/vocal samples

### Drum & Bass (170-180 BPM)
- Syncopated breakbeat patterns
- Sub bass (40-80 Hz)
- Fast hi-hat rolls
- Reese bass sounds

### Lo-fi Hip Hop (70-90 BPM)
- Laid-back drum patterns
- Vinyl crackle/noise
- Jazz chord progressions
- Pitched/warped samples

---

## See Also

- **ralph_mcp.md** - Ralph-MCP agent's implementation guide
- **ABLETONOSC.md** - Legacy OSC-based control (deprecated)
- **[Ableton MCP Extended GitHub](https://github.com/uisato/ableton-mcp-extended)** - Upstream project

---

*Last updated: January 17, 2026*
*For Teacher Agent use in ClaudeVST project*
