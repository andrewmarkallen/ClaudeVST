# Sound Design Coaching System - Brainstorm

**Date:** 2026-01-17
**Status:** In Progress (save point before context compact)

## The Vision

A terminal-based sound design coaching system where Claude:
- Reads device parameters + audio analysis to diagnose issues
- Gives specific, actionable feedback ("FM From B = 10-20%, not 60%")
- Explains WHY so the user learns, not just WHAT to do
- Can demonstrate concepts with quick A/B examples

## Key Insights

### 1. Terminal-First Approach
Don't get distracted building VST UI polish. Make the terminal useful first.

### 2. Parameter-Aware Coaching (80% of value without "hearing")
- Read device chains, parameter values, audio analysis
- Domain knowledge + parameters = instant diagnosis
- Example: "Your compressor ratio is 8:1 with 0.1ms attack - that's slamming transients"

### 3. Triggered by Detailed Questions When Stuck
- User describes what sounds wrong to them
- Not stock answers - specific to their problem
- Mastering they're OK with - it's mix/sound design that needs help

### 4. Reference Track Workflow (High Value)
- Add reference track by file path
- Auto-align BPM
- Extract structure at low token cost (drops, risers, arrangement markers)
- Scaffold MIDI clips for elements
- "Deploy my clips against this reference arrangement"

### 5. Quick Demonstrations
- "Show me what you mean" - 2-bar A/B examples
- Syncopated vs non-syncopated
- Educational, not just doing it for them

## Diagnostic Pattern That Works (from ChatGPT convos)

1. **Symptom** → "huge midrange hole around 8-12 kHz"
2. **Root causes** → "This can only happen from: destructive multiband limiting, phase cancellation..."
3. **Specific fix** → "Delete the first limiter. Chain: Utility (-12 dB) → Limiter"
4. **Explanation** → "Two limiters break because Limiter 1 smashes transients → Limiter 2 has nothing left"

### Concrete Examples of Useful Advice
- "Kick & rumble mono, Synth + noise wide"
- "Sculpt rumble below 50-60 Hz to avoid mud"
- "Saturator: Analog Clip mode, Drive +4 to +8 dB, Soft Clip ON"
- "A/B master loudness > -11 LUFS"
- "FM From B = 10-20%, not 60% (that produces woofy mud)"

## Technical Debt to Address

1. **Browser queries** - 131k token bomb, need efficient user library access
2. **Subagent review loops** - Can be expensive, optimize workflow
3. **CLAUDE.md rules** - Add "don't query full browser tree" type guards

## What Audio Analysis We Have
- 8-band FFT spectrum
- RMS/peak levels (dB)
- Crest factor (dynamics)
- Updated at 2Hz

## What We'd Need to Add
- Reference track analysis (structure extraction)
- BPM detection/alignment
- Arrangement marker scaffolding
- Efficient clip deployment

## Design Decisions (Finalized)

### Reference Track Workflow
- **Structure extraction:** Macro sections + energy curve (not exact patterns)
- **Use existing tools:** Leverage feature extraction libraries, don't reinvent
- **Output:** Section markers with bar counts + relative energy levels

### Mix Comparison
- **Triggered analysis:** Only compare when asked (not constant monitoring)
- **Spectrum + dynamics:** Both available on-demand
- **Example:** "How does my low end compare?" triggers focused analysis

### Coaching Interface
- **Hybrid approach:** Natural language by default, explicit commands for expensive ops
- **Commands:** `/compare-ref`, `/analyze-structure` for token-heavy operations
- **Natural:** "Why does my kick sound muddy?" → reads current state, responds

### VST Integration (Future)
- Quick action buttons deferred for now
- Terminal-first, VST buttons later once patterns established

## Implementation Scope: Full Vision
1. Parameter-aware coaching system
2. Reference track workflow (BPM align, structure extract, scaffold)
3. Triggered A/B comparison
4. Hybrid command interface
5. Token efficiency fixes

---

## Raw Notes from ChatGPT Conversations

### Mixing Priorities (from convos)
```
Kick + Rumble relationship
→ Sculpt the rumble below 50–60 Hz to avoid mud

High frequency clarity
→ Hats should sit above everything else, crisp but not harsh

Mono vs Wide
→ Kick & rumble mono
→ Synth + noise wide
```

### Rumble Chain Fix
```
Problem: "raw kick → reverb sounds like washy mess"
Fix: Kick → Reverb → EQ → Distortion → Compressor (Sidechain) → Utility
```

### Saturator Settings (Techno)
```
Mode: Analog Clip
Drive: +4 to +8 dB
Soft Clip: ON
DC Filter: ON
Output: match original loudness
```

### Two Limiters Problem
```
Limiter 1 pushes transients into ceiling
→ Limiter 2 receives already-smashed waveform
→ It has nothing left to work with
→ Combined GR reaches 10–20 dB
→ Kick disappears
→ High end turns into white noise
```

---

*To continue: compact context, reload this document, continue brainstorming*
