# Reference Track Loader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load a reference track, analyze its structure with MSAF, display as radial visualization, and create clips in Ableton session/arrangement views.

**Architecture:** Docker container runs MSAF analysis → returns hierarchical JSON → VST displays radial view with detail slider → on Apply, calls unified-bridge MCP tools to create audio tracks and clips in Ableton.

**Tech Stack:** Python/MSAF (Docker), TypeScript (unified-bridge MCP), C++/JUCE (VST UI), Python (Ableton Remote Script)

---

## Phase 1: Docker Container (MSAF Analyzer)

### Task 1.1: Create Docker Directory Structure

**Files:**
- Create: `companions/msaf-analyzer/Dockerfile`
- Create: `companions/msaf-analyzer/analyze.py`
- Create: `companions/msaf-analyzer/requirements.txt`

**Step 1: Create directory**

```bash
mkdir -p companions/msaf-analyzer
```

**Step 2: Create requirements.txt**

```txt
msaf>=0.1.8
librosa>=0.10.0
numpy>=1.24.0
soundfile>=0.12.0
```

**Step 3: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY analyze.py /app/analyze.py
WORKDIR /app

ENTRYPOINT ["python", "analyze.py"]
```

**Step 4: Commit**

```bash
git add companions/msaf-analyzer/
git commit -m "feat(msaf): add Docker container scaffolding"
```

---

### Task 1.2: Implement MSAF Analysis Script

**Files:**
- Modify: `companions/msaf-analyzer/analyze.py`

**Step 1: Write analyze.py**

```python
#!/usr/bin/env python3
"""
MSAF-based music structure analysis.
Outputs hierarchical segment boundaries as JSON.
"""

import sys
import json
import msaf
import librosa


def analyze_structure(audio_path: str, num_levels: int = 3) -> dict:
    """
    Analyze audio file structure using MSAF.

    Returns hierarchical segmentation with multiple granularity levels.
    """
    # Load audio to get duration and tempo
    y, sr = librosa.load(audio_path, sr=22050)
    duration = librosa.get_duration(y=y, sr=sr)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo)

    # Calculate bar duration for transition detection
    beats_per_bar = 4  # Assume 4/4
    bar_duration = (60.0 / tempo) * beats_per_bar
    transition_threshold = bar_duration * 2  # < 2 bars = transition

    result = {
        "duration_seconds": duration,
        "tempo_bpm": tempo,
        "levels": []
    }

    # Run MSAF with different granularities
    # Using Spectral Clustering (most reliable for electronic music)
    for level in range(num_levels):
        # Adjust number of segments per level
        # Level 0 = coarse (fewer segments), higher levels = finer
        min_segments = 4 + (level * 4)  # 4, 8, 12 segments roughly

        try:
            boundaries, labels = msaf.process(
                audio_path,
                boundaries_id="sf",  # Spectral Flux
                labels_id="fmc2d",   # 2D Fourier Magnitude Coefficients
            )

            segments = []
            label_names = ["intro", "verse", "chorus", "bridge", "outro", "break", "drop", "buildup"]

            for i in range(len(boundaries) - 1):
                start = float(boundaries[i])
                end = float(boundaries[i + 1])
                duration_seg = end - start

                # Map numeric labels to names (cycling through)
                label_idx = int(labels[i]) if i < len(labels) else 0
                label_name = label_names[label_idx % len(label_names)]

                # Flag short segments as transitions
                is_transition = duration_seg < transition_threshold

                segments.append({
                    "start": round(start, 3),
                    "end": round(end, 3),
                    "label": label_name,
                    "is_transition": is_transition
                })

            result["levels"].append({
                "level": level,
                "segments": segments
            })

        except Exception as e:
            # If MSAF fails at a level, use simple equal division
            num_segs = min_segments
            seg_duration = duration / num_segs
            segments = []
            for i in range(num_segs):
                start = i * seg_duration
                end = (i + 1) * seg_duration
                segments.append({
                    "start": round(start, 3),
                    "end": round(end, 3),
                    "label": f"section_{i+1}",
                    "is_transition": False
                })
            result["levels"].append({
                "level": level,
                "segments": segments
            })

    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze.py <audio_file>"}))
        sys.exit(1)

    audio_path = sys.argv[1]

    try:
        result = analyze_structure(audio_path)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add companions/msaf-analyzer/analyze.py
git commit -m "feat(msaf): implement structure analysis script"
```

---

### Task 1.3: Build and Test Docker Container

**Step 1: Build Docker image**

```bash
cd companions/msaf-analyzer
docker build -t msaf-analyzer .
```

**Step 2: Test with a sample audio file**

Find or create a test audio file, then run:

```bash
docker run --rm -v "/path/to/test.wav:/input.wav" msaf-analyzer /input.wav
```

**Expected output:** JSON with duration_seconds, tempo_bpm, and levels array.

**Step 3: Verify JSON structure**

Check that output contains:
- `duration_seconds`: positive number
- `tempo_bpm`: number between 60-200
- `levels`: array with at least 1 level
- Each level has `segments` array
- Each segment has `start`, `end`, `label`, `is_transition`

**Step 4: Document any issues**

If MSAF has dependency issues, note them for troubleshooting.

---

## Phase 2: Remote Script Handlers

### Task 2.1: Add create_audio_track Handler

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Reference:** Current handlers are in the `_handle_command` method.

**Step 1: Add handler method**

Add after existing track methods (around line 150-200):

```python
def _create_audio_track(self, index=-1):
    """Create a new audio track."""
    try:
        self._song.create_audio_track(index)
        # Get the newly created track
        if index == -1:
            track = self._song.tracks[-1]
            track_index = len(self._song.tracks) - 1
        else:
            track = self._song.tracks[index]
            track_index = index
        return {"success": True, "track_index": track_index, "name": track.name}
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add to command dispatch**

In `_handle_command`, add case:

```python
elif command == "create_audio_track":
    index = data.get("index", -1)
    result = self._create_audio_track(index)
```

**Step 3: Commit**

```bash
git add companions/ableton-mcp-extended/
git commit -m "feat(remote-script): add create_audio_track handler"
```

---

### Task 2.2: Add create_audio_clip_session Handler (ClipSlot)

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add handler method**

```python
def _create_audio_clip_session(self, track_index, clip_index, file_path):
    """Create an audio clip in a session view clip slot from a file."""
    try:
        track = self._song.tracks[track_index]
        if not track.has_audio_input:
            return {"error": "Track is not an audio track"}

        clip_slot = track.clip_slots[clip_index]
        if clip_slot.has_clip:
            return {"error": "Clip slot already has a clip"}

        # Create audio clip from file
        clip_slot.create_audio_clip(file_path)

        return {
            "success": True,
            "track_index": track_index,
            "clip_index": clip_index,
            "file_path": file_path
        }
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add to command dispatch**

```python
elif command == "create_audio_clip_session":
    track_index = data.get("track_index")
    clip_index = data.get("clip_index")
    file_path = data.get("file_path")
    result = self._create_audio_clip_session(track_index, clip_index, file_path)
```

**Step 3: Commit**

```bash
git add companions/ableton-mcp-extended/
git commit -m "feat(remote-script): add create_audio_clip_session handler"
```

---

### Task 2.3: Add create_audio_clip_arrangement Handler (Track)

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add handler method**

```python
def _create_audio_clip_arrangement(self, track_index, file_path, position):
    """Create an audio clip in arrangement view at a position (in beats)."""
    try:
        track = self._song.tracks[track_index]
        if not track.has_audio_input:
            return {"error": "Track is not an audio track"}

        # Create audio clip at position
        track.create_audio_clip(file_path, position)

        return {
            "success": True,
            "track_index": track_index,
            "file_path": file_path,
            "position": position
        }
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add to command dispatch**

```python
elif command == "create_audio_clip_arrangement":
    track_index = data.get("track_index")
    file_path = data.get("file_path")
    position = data.get("position", 0.0)
    result = self._create_audio_clip_arrangement(track_index, file_path, position)
```

**Step 3: Commit**

```bash
git add companions/ableton-mcp-extended/
git commit -m "feat(remote-script): add create_audio_clip_arrangement handler"
```

---

### Task 2.4: Add set_clip_color Handler

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add handler method**

```python
def _set_clip_color(self, track_index, clip_index, color_index):
    """Set the color of a clip (0-69 are Ableton's color palette)."""
    try:
        track = self._song.tracks[track_index]
        clip_slot = track.clip_slots[clip_index]

        if not clip_slot.has_clip:
            return {"error": "No clip in slot"}

        clip = clip_slot.clip
        clip.color_index = color_index

        return {
            "success": True,
            "track_index": track_index,
            "clip_index": clip_index,
            "color_index": color_index
        }
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add to command dispatch**

```python
elif command == "set_clip_color":
    track_index = data.get("track_index")
    clip_index = data.get("clip_index")
    color_index = data.get("color_index")
    result = self._set_clip_color(track_index, clip_index, color_index)
```

**Step 3: Commit**

```bash
git add companions/ableton-mcp-extended/
git commit -m "feat(remote-script): add set_clip_color handler"
```

---

### Task 2.5: Add set_clip_start_end Handler

**Files:**
- Modify: `companions/ableton-mcp-extended/AbletonMCP_Remote_Script/__init__.py`

**Step 1: Add handler method**

```python
def _set_clip_start_end(self, track_index, clip_index, start_marker, end_marker):
    """Set the start and end markers of an audio clip (in beats relative to clip)."""
    try:
        track = self._song.tracks[track_index]
        clip_slot = track.clip_slots[clip_index]

        if not clip_slot.has_clip:
            return {"error": "No clip in slot"}

        clip = clip_slot.clip

        # Set loop/region markers
        if start_marker is not None:
            clip.loop_start = start_marker
            clip.start_marker = start_marker
        if end_marker is not None:
            clip.loop_end = end_marker
            clip.end_marker = end_marker

        return {
            "success": True,
            "track_index": track_index,
            "clip_index": clip_index,
            "start_marker": start_marker,
            "end_marker": end_marker
        }
    except Exception as e:
        return {"error": str(e)}
```

**Step 2: Add to command dispatch**

```python
elif command == "set_clip_start_end":
    track_index = data.get("track_index")
    clip_index = data.get("clip_index")
    start_marker = data.get("start_marker")
    end_marker = data.get("end_marker")
    result = self._set_clip_start_end(track_index, clip_index, start_marker, end_marker)
```

**Step 3: Commit**

```bash
git add companions/ableton-mcp-extended/
git commit -m "feat(remote-script): add set_clip_start_end handler"
```

---

## Phase 3: MCP Tool Definitions

### Task 3.1: Add Audio Track and Clip Tools to Unified Bridge

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts`

**Step 1: Add tool definitions**

Add after existing track tools (around line 200-300):

```typescript
// Audio Track Creation
{
  name: 'create_audio_track',
  description: 'Create a new audio track',
  inputSchema: {
    type: 'object',
    properties: {
      index: { type: 'number', description: 'Index to insert at (-1 for end)', default: -1 },
    },
  },
},

// Session View Audio Clips
{
  name: 'create_audio_clip_session',
  description: 'Create an audio clip in a session view clip slot from a file path',
  inputSchema: {
    type: 'object',
    properties: {
      track_index: { type: 'number', description: 'Index of the audio track' },
      clip_index: { type: 'number', description: 'Index of the clip slot' },
      file_path: { type: 'string', description: 'Absolute path to the audio file' },
    },
    required: ['track_index', 'clip_index', 'file_path'],
  },
},

// Arrangement View Audio Clips
{
  name: 'create_audio_clip_arrangement',
  description: 'Create an audio clip in arrangement view at a position',
  inputSchema: {
    type: 'object',
    properties: {
      track_index: { type: 'number', description: 'Index of the audio track' },
      file_path: { type: 'string', description: 'Absolute path to the audio file' },
      position: { type: 'number', description: 'Position in beats', default: 0 },
    },
    required: ['track_index', 'file_path'],
  },
},

// Clip Color
{
  name: 'set_clip_color',
  description: 'Set the color of a clip (0-69 color palette index)',
  inputSchema: {
    type: 'object',
    properties: {
      track_index: { type: 'number', description: 'Index of the track' },
      clip_index: { type: 'number', description: 'Index of the clip slot' },
      color_index: { type: 'number', description: 'Color index (0-69)' },
    },
    required: ['track_index', 'clip_index', 'color_index'],
  },
},

// Clip Start/End Markers
{
  name: 'set_clip_start_end',
  description: 'Set the start and end markers of a clip',
  inputSchema: {
    type: 'object',
    properties: {
      track_index: { type: 'number', description: 'Index of the track' },
      clip_index: { type: 'number', description: 'Index of the clip slot' },
      start_marker: { type: 'number', description: 'Start marker position in beats' },
      end_marker: { type: 'number', description: 'End marker position in beats' },
    },
    required: ['track_index', 'clip_index'],
  },
},
```

**Step 2: Add tool handlers in the switch statement**

```typescript
case 'create_audio_track':
  return this.sendCommand('create_audio_track', args);

case 'create_audio_clip_session':
  return this.sendCommand('create_audio_clip_session', args);

case 'create_audio_clip_arrangement':
  return this.sendCommand('create_audio_clip_arrangement', args);

case 'set_clip_color':
  return this.sendCommand('set_clip_color', args);

case 'set_clip_start_end':
  return this.sendCommand('set_clip_start_end', args);
```

**Step 3: Build and commit**

```bash
cd companions/unified-bridge
npm run build
git add .
git commit -m "feat(mcp): add audio track and clip creation tools"
```

---

## Phase 4: VST UI

### Task 4.1: Create Reference Track Data Structures

**Files:**
- Create: `src/ReferenceTrackData.h`

**Step 1: Create header file**

```cpp
#pragma once

#include <JuceHeader.h>
#include <vector>

struct Segment
{
    float startSeconds;
    float endSeconds;
    juce::String label;
    bool isTransition;
    juce::Colour color;
};

struct HierarchyLevel
{
    int level;
    std::vector<Segment> segments;
};

struct ReferenceTrackData
{
    juce::String filePath;
    float durationSeconds = 0.0f;
    float tempoBpm = 120.0f;
    std::vector<HierarchyLevel> levels;
    int currentLevel = 0;

    bool isLoaded() const { return !filePath.isEmpty() && !levels.empty(); }

    const std::vector<Segment>& getCurrentSegments() const
    {
        if (currentLevel >= 0 && currentLevel < levels.size())
            return levels[currentLevel].segments;
        static std::vector<Segment> empty;
        return empty;
    }

    static ReferenceTrackData fromJson(const juce::String& json, const juce::String& filePath);
};
```

**Step 2: Create implementation file**

Create: `src/ReferenceTrackData.cpp`

```cpp
#include "ReferenceTrackData.h"

namespace
{
    juce::Colour getRainbowColor(float position)
    {
        // Position 0-1 maps to rainbow (red -> violet)
        float hue = position * 0.8f; // 0 to 0.8 covers red to violet
        return juce::Colour::fromHSV(hue, 0.7f, 0.9f, 1.0f);
    }
}

ReferenceTrackData ReferenceTrackData::fromJson(const juce::String& json, const juce::String& filePath)
{
    ReferenceTrackData data;
    data.filePath = filePath;

    auto parsed = juce::JSON::parse(json);
    if (parsed.isVoid())
        return data;

    auto* obj = parsed.getDynamicObject();
    if (!obj)
        return data;

    data.durationSeconds = static_cast<float>(obj->getProperty("duration_seconds"));
    data.tempoBpm = static_cast<float>(obj->getProperty("tempo_bpm"));

    auto levelsArray = obj->getProperty("levels");
    if (levelsArray.isArray())
    {
        for (int i = 0; i < levelsArray.size(); ++i)
        {
            auto levelObj = levelsArray[i].getDynamicObject();
            if (!levelObj)
                continue;

            HierarchyLevel level;
            level.level = static_cast<int>(levelObj->getProperty("level"));

            auto segmentsArray = levelObj->getProperty("segments");
            if (segmentsArray.isArray())
            {
                int numSegments = segmentsArray.size();
                for (int j = 0; j < numSegments; ++j)
                {
                    auto segObj = segmentsArray[j].getDynamicObject();
                    if (!segObj)
                        continue;

                    Segment seg;
                    seg.startSeconds = static_cast<float>(segObj->getProperty("start"));
                    seg.endSeconds = static_cast<float>(segObj->getProperty("end"));
                    seg.label = segObj->getProperty("label").toString();
                    seg.isTransition = static_cast<bool>(segObj->getProperty("is_transition"));
                    seg.color = getRainbowColor(static_cast<float>(j) / static_cast<float>(numSegments));

                    level.segments.push_back(seg);
                }
            }

            data.levels.push_back(level);
        }
    }

    return data;
}
```

**Step 3: Commit**

```bash
git add src/ReferenceTrackData.h src/ReferenceTrackData.cpp
git commit -m "feat(vst): add reference track data structures"
```

---

### Task 4.2: Create Radial View Component

**Files:**
- Create: `src/RadialSegmentView.h`
- Create: `src/RadialSegmentView.cpp`

**Step 1: Create header**

```cpp
#pragma once

#include <JuceHeader.h>
#include "ReferenceTrackData.h"

class RadialSegmentView : public juce::Component
{
public:
    RadialSegmentView();

    void setData(const ReferenceTrackData* data);
    void paint(juce::Graphics& g) override;
    void resized() override;
    void mouseMove(const juce::MouseEvent& event) override;

private:
    const ReferenceTrackData* trackData = nullptr;
    int hoveredSegment = -1;

    juce::Rectangle<float> getArcBounds() const;
    int getSegmentAtPoint(juce::Point<float> point) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(RadialSegmentView)
};
```

**Step 2: Create implementation**

```cpp
#include "RadialSegmentView.h"

RadialSegmentView::RadialSegmentView()
{
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
}

void RadialSegmentView::setData(const ReferenceTrackData* data)
{
    trackData = data;
    repaint();
}

juce::Rectangle<float> RadialSegmentView::getArcBounds() const
{
    auto bounds = getLocalBounds().toFloat().reduced(10);
    float size = juce::jmin(bounds.getWidth(), bounds.getHeight());
    return bounds.withSizeKeepingCentre(size, size);
}

void RadialSegmentView::paint(juce::Graphics& g)
{
    auto arcBounds = getArcBounds();
    float centerX = arcBounds.getCentreX();
    float centerY = arcBounds.getCentreY();
    float radius = arcBounds.getWidth() / 2.0f;

    // Background circle
    g.setColour(juce::Colour(0xff2a2a2a));
    g.fillEllipse(arcBounds);

    if (!trackData || !trackData->isLoaded())
    {
        g.setColour(juce::Colours::grey);
        g.drawText("No track loaded", arcBounds, juce::Justification::centred);
        return;
    }

    // Draw segments as arcs
    const auto& segments = trackData->getCurrentSegments();
    float totalDuration = trackData->durationSeconds;

    float startAngle = -juce::MathConstants<float>::halfPi; // Start at top

    for (int i = 0; i < segments.size(); ++i)
    {
        const auto& seg = segments[i];
        float segmentDuration = seg.endSeconds - seg.startSeconds;
        float sweepAngle = (segmentDuration / totalDuration) * juce::MathConstants<float>::twoPi;

        juce::Path arc;
        arc.addPieSegment(arcBounds, startAngle, startAngle + sweepAngle, 0.5f);

        // Highlight hovered segment
        juce::Colour fillColor = seg.color;
        if (i == hoveredSegment)
            fillColor = fillColor.brighter(0.3f);
        if (seg.isTransition)
            fillColor = fillColor.withAlpha(0.6f);

        g.setColour(fillColor);
        g.fillPath(arc);

        // Draw segment border
        g.setColour(juce::Colours::black.withAlpha(0.3f));
        g.strokePath(arc, juce::PathStrokeType(1.0f));

        // Draw label for larger segments
        if (sweepAngle > 0.3f)
        {
            float labelAngle = startAngle + sweepAngle / 2.0f;
            float labelRadius = radius * 0.75f;
            float labelX = centerX + std::cos(labelAngle) * labelRadius;
            float labelY = centerY + std::sin(labelAngle) * labelRadius;

            g.setColour(juce::Colours::white);
            g.setFont(12.0f);
            g.drawText(seg.label,
                       juce::Rectangle<float>(labelX - 40, labelY - 10, 80, 20),
                       juce::Justification::centred);
        }

        startAngle += sweepAngle;
    }

    // Draw hover tooltip
    if (hoveredSegment >= 0 && hoveredSegment < segments.size())
    {
        const auto& seg = segments[hoveredSegment];
        int startMins = static_cast<int>(seg.startSeconds) / 60;
        int startSecs = static_cast<int>(seg.startSeconds) % 60;
        int endMins = static_cast<int>(seg.endSeconds) / 60;
        int endSecs = static_cast<int>(seg.endSeconds) % 60;

        juce::String tooltip = seg.label + juce::String::formatted(": %d:%02d - %d:%02d",
                                                                    startMins, startSecs,
                                                                    endMins, endSecs);
        if (seg.isTransition)
            tooltip += " [transition]";

        g.setColour(juce::Colours::white);
        g.setFont(11.0f);
        g.drawText(tooltip, getLocalBounds().removeFromBottom(20), juce::Justification::centred);
    }
}

void RadialSegmentView::resized()
{
    repaint();
}

int RadialSegmentView::getSegmentAtPoint(juce::Point<float> point) const
{
    if (!trackData || !trackData->isLoaded())
        return -1;

    auto arcBounds = getArcBounds();
    float centerX = arcBounds.getCentreX();
    float centerY = arcBounds.getCentreY();
    float radius = arcBounds.getWidth() / 2.0f;

    float dx = point.x - centerX;
    float dy = point.y - centerY;
    float distance = std::sqrt(dx * dx + dy * dy);

    // Check if within donut (0.5 to 1.0 of radius)
    if (distance < radius * 0.5f || distance > radius)
        return -1;

    // Calculate angle
    float angle = std::atan2(dy, dx);
    // Normalize to 0-2π starting from top
    angle += juce::MathConstants<float>::halfPi;
    if (angle < 0)
        angle += juce::MathConstants<float>::twoPi;

    // Find segment
    const auto& segments = trackData->getCurrentSegments();
    float totalDuration = trackData->durationSeconds;
    float currentAngle = 0.0f;

    for (int i = 0; i < segments.size(); ++i)
    {
        const auto& seg = segments[i];
        float segmentDuration = seg.endSeconds - seg.startSeconds;
        float sweepAngle = (segmentDuration / totalDuration) * juce::MathConstants<float>::twoPi;

        if (angle >= currentAngle && angle < currentAngle + sweepAngle)
            return i;

        currentAngle += sweepAngle;
    }

    return -1;
}

void RadialSegmentView::mouseMove(const juce::MouseEvent& event)
{
    int newHovered = getSegmentAtPoint(event.position);
    if (newHovered != hoveredSegment)
    {
        hoveredSegment = newHovered;
        repaint();
    }
}
```

**Step 3: Commit**

```bash
git add src/RadialSegmentView.h src/RadialSegmentView.cpp
git commit -m "feat(vst): add radial segment visualization component"
```

---

### Task 4.3: Create Docker Runner Utility

**Files:**
- Create: `src/DockerRunner.h`
- Create: `src/DockerRunner.cpp`

**Step 1: Create header**

```cpp
#pragma once

#include <JuceHeader.h>
#include <functional>

class DockerRunner
{
public:
    using CompletionCallback = std::function<void(bool success, const juce::String& output)>;

    static void runMsafAnalysis(const juce::String& audioFilePath, CompletionCallback callback);

private:
    static bool isDockerAvailable();
};
```

**Step 2: Create implementation**

```cpp
#include "DockerRunner.h"

bool DockerRunner::isDockerAvailable()
{
    juce::ChildProcess process;
    if (process.start("docker --version"))
    {
        process.waitForProcessToFinish(5000);
        return process.getExitCode() == 0;
    }
    return false;
}

void DockerRunner::runMsafAnalysis(const juce::String& audioFilePath, CompletionCallback callback)
{
    // Run in background thread
    std::thread([audioFilePath, callback]()
    {
        if (!isDockerAvailable())
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Docker is not available. Please install and start Docker.");
            });
            return;
        }

        // Build docker command
        juce::File audioFile(audioFilePath);
        if (!audioFile.existsAsFile())
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Audio file not found.");
            });
            return;
        }

        juce::String parentDir = audioFile.getParentDirectory().getFullPathName();
        juce::String fileName = audioFile.getFileName();

        juce::String command = "docker run --rm -v \"" + parentDir + ":/audio\" msaf-analyzer /audio/" + fileName;

        juce::ChildProcess process;
        if (!process.start(command))
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Failed to start Docker process.");
            });
            return;
        }

        // Wait for completion (timeout after 60 seconds)
        if (!process.waitForProcessToFinish(60000))
        {
            process.kill();
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Analysis timed out.");
            });
            return;
        }

        juce::String output = process.readAllProcessOutput();
        int exitCode = process.getExitCode();

        juce::MessageManager::callAsync([callback, exitCode, output]()
        {
            callback(exitCode == 0, output);
        });

    }).detach();
}
```

**Step 3: Commit**

```bash
git add src/DockerRunner.h src/DockerRunner.cpp
git commit -m "feat(vst): add Docker runner utility for MSAF analysis"
```

---

### Task 4.4: Update PluginEditor with Reference Track UI

**Files:**
- Modify: `src/PluginEditor.h`
- Modify: `src/PluginEditor.cpp`

**Step 1: Update header - add includes and members**

Add to includes:
```cpp
#include "ReferenceTrackData.h"
#include "RadialSegmentView.h"
#include "DockerRunner.h"
```

Add to private members:
```cpp
// Reference track UI
juce::TextButton loadReferenceButton { "Load Reference" };
juce::TextButton clearButton { "Clear" };
juce::TextButton applyButton { "Apply to Ableton" };
juce::Slider detailSlider;
juce::Label detailLabel;
RadialSegmentView radialView;
ReferenceTrackData referenceData;
bool isAnalyzing = false;

void loadReferenceTrack();
void clearReferenceTrack();
void applyToAbleton();
void updateDetailLevel();
```

**Step 2: Update constructor - initialize new components**

Add after existing component setup:
```cpp
// Reference track section
loadReferenceButton.setColour(juce::TextButton::buttonColourId, accentColor);
loadReferenceButton.onClick = [this] { loadReferenceTrack(); };
addAndMakeVisible(loadReferenceButton);

clearButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a4a4a));
clearButton.onClick = [this] { clearReferenceTrack(); };
addAndMakeVisible(clearButton);

applyButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a9a4a));
applyButton.onClick = [this] { applyToAbleton(); };
applyButton.setEnabled(false);
addAndMakeVisible(applyButton);

detailSlider.setRange(0, 2, 1);  // 3 levels
detailSlider.setValue(1);
detailSlider.setSliderStyle(juce::Slider::LinearHorizontal);
detailSlider.setTextBoxStyle(juce::Slider::NoTextBox, true, 0, 0);
detailSlider.onValueChange = [this] { updateDetailLevel(); };
addAndMakeVisible(detailSlider);

detailLabel.setText("Detail: Medium", juce::dontSendNotification);
detailLabel.setColour(juce::Label::textColourId, textColor);
addAndMakeVisible(detailLabel);

addAndMakeVisible(radialView);
```

**Step 3: Update resized() - layout new components**

Replace the resized() implementation (expand window to 500x750):
```cpp
void ClaudeVSTAudioProcessorEditor::resized()
{
    auto bounds = getLocalBounds().reduced(10);

    // Header space
    bounds.removeFromTop(40);

    // Level display at top
    levelLabel.setBounds(bounds.removeFromTop(20));
    bounds.removeFromTop(5);

    // Reference track section
    auto refSection = bounds.removeFromTop(280);

    auto buttonRow = refSection.removeFromTop(30);
    loadReferenceButton.setBounds(buttonRow.removeFromLeft(120));
    buttonRow.removeFromLeft(10);
    clearButton.setBounds(buttonRow.removeFromLeft(60));

    refSection.removeFromTop(10);
    radialView.setBounds(refSection.removeFromTop(180));

    refSection.removeFromTop(5);
    auto detailRow = refSection.removeFromTop(25);
    detailLabel.setBounds(detailRow.removeFromLeft(100));
    detailSlider.setBounds(detailRow);

    refSection.removeFromTop(5);
    applyButton.setBounds(refSection.removeFromTop(30).reduced(50, 0));

    bounds.removeFromTop(10);

    // Input area at bottom
    auto inputArea = bounds.removeFromBottom(35);
    sendButton.setBounds(inputArea.removeFromRight(60));
    inputArea.removeFromRight(5);
    voiceButton.setBounds(inputArea.removeFromRight(45));
    inputArea.removeFromRight(5);
    inputField.setBounds(inputArea);

    bounds.removeFromBottom(10);

    // Chat history fills the rest
    chatHistory.setBounds(bounds);
}
```

**Step 4: Update setSize in constructor**

```cpp
setSize(500, 750);  // Increased height for reference section
```

**Step 5: Implement new methods**

```cpp
void ClaudeVSTAudioProcessorEditor::loadReferenceTrack()
{
    if (isAnalyzing)
        return;

    auto chooser = std::make_unique<juce::FileChooser>(
        "Select Reference Track",
        juce::File::getSpecialLocation(juce::File::userMusicDirectory),
        "*.wav;*.mp3;*.flac;*.aiff");

    auto chooserFlags = juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles;

    chooser->launchAsync(chooserFlags, [this](const juce::FileChooser& fc)
    {
        auto file = fc.getResult();
        if (file.existsAsFile())
        {
            isAnalyzing = true;
            loadReferenceButton.setButtonText("Analyzing...");
            loadReferenceButton.setEnabled(false);

            DockerRunner::runMsafAnalysis(file.getFullPathName(),
                [this, filePath = file.getFullPathName()](bool success, const juce::String& output)
            {
                isAnalyzing = false;
                loadReferenceButton.setButtonText("Load Reference");
                loadReferenceButton.setEnabled(true);

                if (success)
                {
                    referenceData = ReferenceTrackData::fromJson(output, filePath);
                    if (referenceData.isLoaded())
                    {
                        radialView.setData(&referenceData);
                        applyButton.setEnabled(true);
                        detailSlider.setValue(1);
                        appendToChat("System", "Reference track loaded: " +
                                     juce::String(referenceData.getCurrentSegments().size()) + " segments detected");
                    }
                    else
                    {
                        appendToChat("System", "Failed to parse analysis results");
                    }
                }
                else
                {
                    appendToChat("System", "Analysis failed: " + output);
                }
            });
        }
    });
}

void ClaudeVSTAudioProcessorEditor::clearReferenceTrack()
{
    referenceData = ReferenceTrackData();
    radialView.setData(nullptr);
    applyButton.setEnabled(false);
}

void ClaudeVSTAudioProcessorEditor::updateDetailLevel()
{
    int level = static_cast<int>(detailSlider.getValue());
    referenceData.currentLevel = level;

    juce::String levelName;
    switch (level)
    {
        case 0: levelName = "Coarse"; break;
        case 1: levelName = "Medium"; break;
        case 2: levelName = "Fine"; break;
        default: levelName = "Medium";
    }
    detailLabel.setText("Detail: " + levelName, juce::dontSendNotification);

    radialView.setData(&referenceData);
}

void ClaudeVSTAudioProcessorEditor::applyToAbleton()
{
    // TODO: Implement in Phase 5 - Integration
    // Will call unified-bridge to create tracks and clips
    appendToChat("System", "Apply to Ableton - not yet implemented");
}
```

**Step 6: Commit**

```bash
git add src/PluginEditor.h src/PluginEditor.cpp
git commit -m "feat(vst): add reference track UI with radial view"
```

---

### Task 4.5: Update CMakeLists.txt

**Files:**
- Modify: `CMakeLists.txt`

**Step 1: Add new source files to target**

Find the `target_sources` section and add:
```cmake
    src/ReferenceTrackData.cpp
    src/ReferenceTrackData.h
    src/RadialSegmentView.cpp
    src/RadialSegmentView.h
    src/DockerRunner.cpp
    src/DockerRunner.h
```

**Step 2: Commit**

```bash
git add CMakeLists.txt
git commit -m "build: add reference track source files to CMake"
```

---

## Phase 5: Integration

### Task 5.1: Implement applyToAbleton Session View

**Files:**
- Modify: `src/PluginEditor.cpp`
- Create: `src/UnifiedBridgeClient.h` (if not exists)

**Step 1: Add UnifiedBridgeClient for REST calls**

Create `src/UnifiedBridgeClient.h`:
```cpp
#pragma once

#include <JuceHeader.h>
#include <functional>

class UnifiedBridgeClient
{
public:
    using ResponseCallback = std::function<void(bool success, const juce::var& response)>;

    static void sendCommand(const juce::String& command, const juce::var& args, ResponseCallback callback);

    // Convenience methods
    static void createAudioTrack(int index, ResponseCallback callback);
    static void createAudioClipSession(int trackIndex, int clipIndex, const juce::String& filePath, ResponseCallback callback);
    static void setClipName(int trackIndex, int clipIndex, const juce::String& name, ResponseCallback callback);
    static void setClipColor(int trackIndex, int clipIndex, int colorIndex, ResponseCallback callback);
};
```

**Step 2: Update applyToAbleton in PluginEditor.cpp**

```cpp
void ClaudeVSTAudioProcessorEditor::applyToAbleton()
{
    if (!referenceData.isLoaded())
        return;

    applyButton.setEnabled(false);
    applyButton.setButtonText("Creating...");

    // First, create the audio track
    UnifiedBridgeClient::createAudioTrack(-1, [this](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create audio track");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        int trackIndex = response.getProperty("track_index", -1);
        if (trackIndex < 0)
        {
            appendToChat("System", "Invalid track index returned");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        // Set track name
        juce::File audioFile(referenceData.filePath);
        juce::String trackName = "Ref: " + audioFile.getFileNameWithoutExtension();

        // Create clips for each segment
        const auto& segments = referenceData.getCurrentSegments();
        createClipsRecursive(trackIndex, 0, segments);
    });
}

void ClaudeVSTAudioProcessorEditor::createClipsRecursive(int trackIndex, int clipIndex,
                                                          const std::vector<Segment>& segments)
{
    if (clipIndex >= segments.size())
    {
        appendToChat("System", "Reference track applied! " +
                     juce::String(segments.size()) + " clips created.");
        applyButton.setEnabled(true);
        applyButton.setButtonText("Apply to Ableton");
        return;
    }

    const auto& seg = segments[clipIndex];

    UnifiedBridgeClient::createAudioClipSession(trackIndex, clipIndex, referenceData.filePath,
        [this, trackIndex, clipIndex, segments, seg](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create clip " + juce::String(clipIndex));
            // Continue anyway
        }

        // Set clip name and color
        UnifiedBridgeClient::setClipName(trackIndex, clipIndex, seg.label,
            [](bool, const juce::var&) {});

        // Map rainbow color to Ableton color index (0-69)
        int colorIndex = static_cast<int>((static_cast<float>(clipIndex) / segments.size()) * 69);
        UnifiedBridgeClient::setClipColor(trackIndex, clipIndex, colorIndex,
            [](bool, const juce::var&) {});

        // Continue with next clip
        createClipsRecursive(trackIndex, clipIndex + 1, segments);
    });
}
```

**Step 3: Add createClipsRecursive declaration to header**

```cpp
void createClipsRecursive(int trackIndex, int clipIndex, const std::vector<Segment>& segments);
```

**Step 4: Commit**

```bash
git add src/PluginEditor.cpp src/PluginEditor.h src/UnifiedBridgeClient.h
git commit -m "feat(vst): implement apply to Ableton session view"
```

---

### Task 5.2: Add Apply Menu with Session/Arrangement/Both Options

**Files:**
- Modify: `src/PluginEditor.cpp`

**Step 1: Replace applyToAbleton with menu**

```cpp
void ClaudeVSTAudioProcessorEditor::applyToAbleton()
{
    if (!referenceData.isLoaded())
        return;

    juce::PopupMenu menu;
    menu.addItem(1, "Session View (clips)");
    menu.addItem(2, "Arrangement View (timeline)");
    menu.addItem(3, "Both");

    menu.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(&applyButton),
        [this](int result)
    {
        switch (result)
        {
            case 1: applyToSession(); break;
            case 2: applyToArrangement(); break;
            case 3: applyToSession(); applyToArrangement(); break;
            default: break;
        }
    });
}
```

**Step 2: Implement applyToArrangement**

```cpp
void ClaudeVSTAudioProcessorEditor::applyToArrangement()
{
    if (!referenceData.isLoaded())
        return;

    appendToChat("System", "Creating arrangement clips...");

    UnifiedBridgeClient::createAudioTrack(-1, [this](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create audio track for arrangement");
            return;
        }

        int trackIndex = response.getProperty("track_index", -1);
        const auto& segments = referenceData.getCurrentSegments();

        // Convert seconds to beats
        float beatsPerSecond = referenceData.tempoBpm / 60.0f;

        for (const auto& seg : segments)
        {
            float positionBeats = seg.startSeconds * beatsPerSecond;

            UnifiedBridgeClient::sendCommand("create_audio_clip_arrangement",
                juce::var(new juce::DynamicObject({
                    {"track_index", trackIndex},
                    {"file_path", referenceData.filePath},
                    {"position", positionBeats}
                })),
                [](bool, const juce::var&) {});
        }

        appendToChat("System", "Arrangement clips created!");
    });
}
```

**Step 3: Add declarations to header**

```cpp
void applyToSession();
void applyToArrangement();
```

**Step 4: Rename existing session logic to applyToSession()**

**Step 5: Commit**

```bash
git add src/PluginEditor.cpp src/PluginEditor.h
git commit -m "feat(vst): add apply menu with session/arrangement/both options"
```

---

### Task 5.3: Install and Test Remote Script

**Step 1: Copy Remote Script to Ableton**

```bash
cp -r companions/ableton-mcp-extended/AbletonMCP_Remote_Script ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonMCP/
```

**Step 2: Restart Ableton**

**Step 3: Test create_audio_track**

From Claude Code:
```
mcp__ableton-unified__create_audio_track
```

Expected: New audio track appears in Ableton.

**Step 4: Test create_audio_clip_session**

Find a test audio file and run:
```
mcp__ableton-unified__create_audio_clip_session track_index=<index> clip_index=0 file_path="/path/to/test.wav"
```

Expected: Audio clip appears in the clip slot.

**Step 5: Document any issues**

---

### Task 5.4: Build and Test Full Integration

**Step 1: Build VST**

```bash
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./scripts/post_build.sh
```

**Step 2: Load in Ableton**

Rescan plugins, add new ClaudeVST to a track.

**Step 3: Test reference track loading**

1. Click "Load Reference"
2. Select an audio file
3. Wait for analysis
4. Verify radial view appears
5. Adjust detail slider
6. Click "Apply to Ableton" → "Session View"
7. Verify clips appear in Ableton

**Step 4: Test arrangement view**

1. Click "Apply to Ableton" → "Arrangement View"
2. Switch to arrangement view in Ableton
3. Verify clips appear on timeline

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete reference track loader integration"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|------------------|
| 1 | 1.1-1.3 | Docker container with MSAF |
| 2 | 2.1-2.5 | Remote Script handlers for audio clips |
| 3 | 3.1 | MCP tool definitions |
| 4 | 4.1-4.5 | VST UI with radial view |
| 5 | 5.1-5.4 | Full integration and testing |

**Total tasks:** 13 major tasks across 5 phases

**Testing checkpoints:**
- After Task 1.3: Docker container works standalone
- After Task 3.1: MCP tools callable from Claude Code
- After Task 4.5: VST builds with new UI
- After Task 5.4: Full end-to-end workflow
