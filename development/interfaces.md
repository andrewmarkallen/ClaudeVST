# ClaudeVST Subsystem Interfaces

**Purpose:** Define communication interfaces between specialized Ralph agents to ensure interoperability.

**Status:** Living document - updated as interfaces evolve

---

## Interface Contract Philosophy

1. **Each Ralph owns their interface** - defines what they expose
2. **Coordinated through Master** - Master reviews compatibility
3. **Documented here** - single source of truth
4. **Versioned** - breaking changes noted

---

## VST ↔ MCP Interface

### VST Sends to MCP
**Connection:** HTTP/socket to MCP unified server

```cpp
// OSCClient.cpp now points to MCP unified server
class OSCClient {
    // Connects to localhost:11000 (MCP server, not raw AbletonOSC)
    bool connect();

    // Executes actions via MCP/OSC routing
    bool executeAction(const juce::var& action);
};
```

**Actions Format:** (unchanged from current)
```json
{
  "action": "fire_clip",
  "track": "Kick",
  "clip_index": 0
}
```

**Ralph-MCP Must Provide:**
- Socket server on localhost:11000
- Accept OSC format messages
- Route to MCP or OSC protocol as appropriate
- Return success/failure status

### MCP Sends to VST
**Connection Status API:**

```http
GET http://localhost:11000/status
Response: {"connected": true, "ableton": true, "osc_ready": true}
```

**Ralph-MCP Must Provide:**
- HTTP endpoint for status checks
- OR write status to `services/mcp_status.json`:
  ```json
  {
    "timestamp": 1768590000000,
    "connected": true,
    "ableton_connected": true,
    "osc_ready": true
  }
  ```

**Ralph-VST Must:**
- Poll status every 2 seconds (timer callback, message thread)
- Display indicator in UI: ✓ (green) or ✗ (red)
- Handle graceful degradation if MCP offline

---

## VST ↔ Whisper Interface

### VST Integrates Whisper
**Direct Link:** VST links libwhisper.dylib, uses SpeechRecognizer class

```cpp
// src/SpeechRecognizer.h (Ralph-Whisper owns this file)
class SpeechRecognizer {
public:
    // Initialize with model path (called once in prepareToPlay)
    bool initialize(const juce::String& modelPath);

    // Start listening (UI thread)
    void startListening(TranscriptionCallback callback);

    // Process audio (AUDIO THREAD - MUST BE LOCK-FREE!)
    void processAudioInput(const float* samples, int numSamples);

    // Stop and transcribe (UI thread)
    void stopListening();

    // Check status
    bool isListening() const;
    bool hasPermission() const;

private:
    class Impl;  // Hides implementation details
};
```

**Contract:**
- `processAudioInput()` MUST be real-time safe (no locks, no allocations)
- Uses ring buffer internally for audio capture
- Transcription runs on background thread
- Callback fires on message thread via MessageManager::callAsync

**Ralph-Whisper Owns:**
- src/SpeechRecognizer.cpp/h implementation
- whisper.cpp submodule and libraries
- Model file location and management

**Ralph-VST Owns:**
- UI button for mic control
- Calling initialize/startListening/stopListening
- Feeding audio from processBlock
- Handling transcription callback

### Model Switching
**Process:**
1. Ralph-Whisper changes WHISPER_MODEL_PATH in CMakeLists.txt
2. Ralph-VST rebuilds with new model (automatic via A/B deploy)
3. User switches to new VST version when ready

**No runtime model switching** - requires rebuild.

---

## VST ↔ TTS Interface

### VST Integrates TTS
**Two Modes:**

#### Mode 1: Standalone TTS Watcher (Current, Recommended)
- VST writes to `messages/from_teacher.json`
- tts_watcher.py monitors and speaks
- No direct VST interface needed

#### Mode 2: Embedded TTS (Future)
```cpp
// src/SpeechSynthesizer.h (Ralph-TTS owns this file)
class SpeechSynthesizer {
public:
    // Initialize (UI thread)
    void prepare(double sampleRate, int samplesPerBlock);

    // Queue speech (UI thread)
    void speak(const juce::String& text);

    // Pull audio (AUDIO THREAD - MUST BE LOCK-FREE!)
    int pullAudio(float* left, float* right, int numSamples);

private:
    class Impl;  // Hides AVSpeechSynthesizer details
};
```

**Contract:**
- `pullAudio()` MUST be real-time safe
- Uses lock-free queue between TTS thread and audio thread
- Returns number of samples written (0 if no speech)

**Ralph-TTS Owns:**
- src/SpeechSynthesizer.mm/h implementation
- companions/tts/tts_watcher.py service
- Voice selection and quality

**Ralph-VST Owns:**
- Calling speak() when response arrives
- Pulling audio in processBlock
- Mixing TTS with other audio (or muting input)

---

## Teacher ↔ MCP Interface

### Teacher Sends Commands to MCP
**Via:** High-level Python API provided by Ralph-MCP

```python
# companions/mcp/teacher_api.py (Ralph-MCP provides this)
class TeacherAbletonControl:
    # Clip creation
    async def create_clip(self, track: int, length_bars: int, notes: List[Note]):
        ...

    # Instrument loading
    async def load_instrument(self, track: int, name: str, preset: str = None):
        ...

    # Pattern generation (genre-aware)
    async def create_hypnotic_bassline(self, track: int, bars: int = 4):
        ...

    # Parameter control (unified MCP/OSC routing)
    async def set_parameter(self, track: int, device: str, param: str, value: float):
        ...

    # OSC to ecosystem
    async def send_to_max(self, patch: str, params: dict):
        ...
```

**Ralph-MCP Must Provide:**
- teacher_api.py with high-level methods
- Automatic MCP vs OSC routing
- Error handling and status feedback
- Genre-aware helpers for teaching

**Teacher Agent Uses:**
```python
# In Teacher agent code
from companions.mcp.teacher_api import TeacherAbletonControl

control = TeacherAbletonControl()

# When demonstrating to student
await control.create_hypnotic_bassline(track=1, bars=4)
await control.load_instrument(track=1, "Operator", preset="FM Bass")
```

---

## MCP ↔ Teacher Message Format

### Teacher's Actions in Response
**File:** `messages/from_teacher.json`

```json
{
  "timestamp": 1768590000000,
  "response": "Let me show you a hypnotic bassline...",
  "actions": [
    {
      "type": "mcp_create_clip",
      "track": 1,
      "bars": 4,
      "notes": [[60, 0.0, 0.25], [60, 0.5, 0.25], ...]
    },
    {
      "type": "mcp_load_instrument",
      "track": 1,
      "instrument": "Operator",
      "preset": "FM Bass"
    }
  ]
}
```

**Ralph-MCP Must:**
- Parse these action types
- Execute via MCP protocol
- Handle errors gracefully
- Log results

**Teacher Agent Must:**
- Format actions correctly
- Use documented action types
- Include all required parameters

---

## All Agents ↔ Service Management

### PID Files
**Location:** `services/*.pid`

Each service writes its PID:
```bash
echo $$ > services/ralph_mcp.pid
```

**Master monitors:**
```bash
# Check if service running
ps -p $(cat services/ralph_mcp.pid)
```

### Logs
**Location:** `logs/*.log`

Each service logs to:
- `logs/ralph_mcp.log`
- `logs/ralph_tts.log`
- etc.

**Format:**
```
[2026-01-16 22:30:15] INFO: MCP server started
[2026-01-16 22:30:16] INFO: Connected to Ableton
[2026-01-16 22:31:00] ERROR: Failed to load instrument: Serum not found
```

---

## Message File Formats

### to_claude.json (VST → Teacher)
```json
{
  "timestamp": 1768590000000,
  "message": "How does my kick sound?",
  "audio_context": "=== AUDIO ANALYSIS ===\n..."
}
```

### from_teacher.json (Teacher → VST)
```json
{
  "timestamp": 1768590000000,
  "response": "Your kick is punchy!",
  "actions": [...]  // Optional MCP/OSC actions
}
```

### to_master.json (VST → Master, M: prefix)
```json
{
  "timestamp": 1768590000000,
  "message": "M: Status check please",
  "context": "..."
}
```

### from_claude.json (Master → VST)
```json
{
  "timestamp": 1768590000000,
  "response": "All services running...",
  "actions": []
}
```

---

## Interface Versioning

### Version Format: YYYY-MM-DD

Current interfaces established: 2026-01-16

### Breaking Changes
If a Ralph needs to change an interface:
1. Propose change in report
2. Master reviews impact on other Ralphs
3. Coordinate updates across affected Ralphs
4. Document version change here

### Example:
```markdown
## 2026-01-20 - SpeechRecognizer Interface v2
**Breaking Change:** Added language parameter to initialize()
**Affects:** Ralph-VST must update call site
**Migration:** initialize(modelPath) → initialize(modelPath, "en")
```

---

## Adding New Interfaces

When a new integration is needed:
1. Ralph proposes interface in report
2. Master reviews and approves
3. Document here before implementation
4. Both Ralphs implement simultaneously

---

## Interface Health Checks

Master periodically verifies:
- All documented interfaces implemented
- No undocumented coupling between subsystems
- Version mismatches identified
- Breaking changes coordinated

---

*This document is updated as interfaces evolve. Last updated: 2026-01-16*
