# Reference Track Loader Design

## Overview

A feature in ClaudeVST that loads a reference track, analyzes its structure using MSAF (Music Structure Analysis Framework), and creates session view and/or arrangement view clips for A/B comparison and visual guidance.

## User Flow

1. User clicks **[Load Reference]** button in VST
2. Native file picker opens, user selects audio file (WAV/MP3/FLAC)
3. VST shows spinner: "Analyzing structure..."
4. Docker container runs MSAF, returns hierarchical segment data
5. **Radial view** appears showing track as colored circle with section arcs
6. **Detail slider** lets user pick hierarchy level (coarse → fine)
7. Short segments (<2 bars) highlighted differently as "transitions"
8. User clicks **[Apply]** and chooses: Session View / Arrangement View / Both
9. Ableton receives:
   - **Session View:** Audio track "Ref: [filename]" with rainbow-colored structural clips + separate "Transitions" track
   - **Arrangement View:** Audio track "Ref: [filename] (Arr)" with clips laid out on timeline

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ClaudeVST (C++)                                                 │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│ │ File Picker │→ │ Docker Call │→ │ Radial View + Slider    │  │
│ └─────────────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│                         │                     │ [Apply]        │
└─────────────────────────┼─────────────────────┼─────────────────┘
                          │                     │
                          ▼                     ▼
              ┌───────────────────┐   ┌─────────────────────┐
              │ Docker Container  │   │ Unified Bridge      │
              │ (Python + MSAF)   │   │ (MCP Server)        │
              │                   │   │                     │
              │ - Load audio      │   │ - Create audio track│
              │ - Run MSAF        │   │ - Create clips      │
              │ - Return JSON     │   │ - Set clip colors   │
              └───────────────────┘   └─────────────────────┘
```

## Docker Container (MSAF Analyzer)

**Location:** `companions/msaf-analyzer/`

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    msaf \
    librosa \
    numpy

COPY analyze.py /app/analyze.py
WORKDIR /app

ENTRYPOINT ["python", "analyze.py"]
```

**Invocation:**

```cpp
juce::String cmd = "docker run --rm -v \"" + filePath + "\":/input.wav msaf-analyzer /input.wav";
juce::ChildProcess process;
process.start(cmd);
juce::String json = process.readAllProcessOutput();
```

**Output JSON format:**

```json
{
  "duration_seconds": 245.5,
  "tempo_bpm": 128.0,
  "levels": [
    {
      "level": 0,
      "segments": [
        {"start": 0.0, "end": 64.0, "label": "intro", "is_transition": false},
        {"start": 64.0, "end": 192.0, "label": "verse", "is_transition": false},
        {"start": 192.0, "end": 245.5, "label": "outro", "is_transition": false}
      ]
    },
    {
      "level": 1,
      "segments": [...]
    }
  ]
}
```

## VST UI Changes

```
┌──────────────────────────────────────┐
│           ClaudeVST                  │
├──────────────────────────────────────┤
│ Levels: RMS L -14.2 dB  R -14.1 dB   │
├──────────────────────────────────────┤
│ [Load Reference]     [Clear]         │
│                                      │
│        ┌──────────────┐              │
│       ╱    Intro      ╲              │
│      │  ┌──────────┐   │             │
│      │  │          │   │  <- Radial  │
│      │  │  (empty) │   │     view    │
│      │  │          │   │             │
│      │  └──────────┘   │             │
│       ╲   Outro       ╱              │
│        └──────────────┘              │
│                                      │
│  Detail: [====○=========] Fine       │
│  Transitions: 2 detected             │
│                                      │
│           [Apply to Ableton]         │
├──────────────────────────────────────┤
│ [Chat history area...]               │
│                                      │
├──────────────────────────────────────┤
│ [________________] [Mic] [Send]      │
└──────────────────────────────────────┘
```

**Radial view:**
- Circle divided into arcs proportional to segment duration
- Rainbow colors based on position (first = red, last = violet)
- Section labels on or near each arc
- Hover shows: "Intro: 0:00 - 1:04 (16 bars)"

## Ableton Integration

**New MCP tools needed:**

```typescript
// Session view (ClipSlot methods)
create_audio_track           // Create new audio track
create_audio_clip_session    // ClipSlot.create_audio_clip(path)
set_clip_color               // Set clip color index (0-69)

// Arrangement view (Track methods)
create_audio_clip_arrangement // Track.create_audio_clip(file_path, position)
```

**Session view creation:**
1. Create audio track "Ref: [filename]"
2. For each segment: `ClipSlot.create_audio_clip(path)`
3. Set clip start/end markers to segment boundaries
4. Set clip names and rainbow colors
5. Create second track "Ref: [filename] - Transitions" for short fills/risers

**Arrangement view creation:**
1. Create audio track "Ref: [filename] (Arr)"
2. For each segment: `Track.create_audio_clip(file_path, position_in_beats)`
3. Clips appear sequentially on timeline
4. Set clip names and colors

**Transitions handling:**
- Segments < 2 bars (based on detected tempo) flagged as transitions
- Session view: Separate track with isolated transition clips
- Arrangement view: Same track (no overlap with structural sections)

## Implementation Phases

### Phase 1: Foundation
- Create `companions/msaf-analyzer/` Docker container
- Test MSAF locally with sample tracks
- Verify hierarchical output format
- Add new Remote Script handlers for `create_audio_clip` methods

### Phase 2: MCP Tools
- Add `create_audio_track` to unified-bridge
- Add `create_audio_clip_session` (ClipSlot method)
- Add `create_audio_clip_arrangement` (Track method)
- Add `set_clip_color`
- Test all tools from Claude Code

### Phase 3: VST UI
- Add "Load Reference" button and file picker
- Implement Docker process spawning from C++
- Parse JSON response
- Build radial view component (JUCE custom component)
- Add detail slider linked to hierarchy levels

### Phase 4: Integration
- Wire Apply button to unified-bridge calls
- Implement session view clip creation
- Implement arrangement view clip creation
- Add transitions track logic
- Handle errors gracefully

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analysis location | Docker container | Isolates Python/MSAF dependencies |
| Visualization | Radial/circular view | Compact, shows proportions at a glance |
| Detail control | Pre-computed hierarchy | Fast interaction, single analysis pass |
| Colors | Rainbow gradient by position | Visually distinct, looks nice |
| Transitions | Separate track | Clean separation, both structural and isolated views |
| Target views | Session + Arrangement | A/B comparison AND timeline reference |

## LOM Methods Used

**Session View (ClipSlot):**
- `ClipSlot.create_audio_clip(path)` - Load audio file into clip slot

**Arrangement View (Track):**
- `Track.create_audio_clip(file_path, position)` - Create audio clip at timeline position
- `Track.create_midi_clip(start_time, length)` - Create MIDI clip (if needed)

**References:**
- https://docs.cycling74.com/apiref/lom/clipslot/
- https://docs.cycling74.com/apiref/lom/track/

---

*Created: 2026-01-21*
