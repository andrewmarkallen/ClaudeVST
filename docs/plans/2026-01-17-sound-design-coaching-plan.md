# Sound Design Coaching System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal-based sound design coaching system that reads device parameters and audio analysis to provide specific, actionable feedback with explanations.

**Architecture:** Hybrid MCP/natural language system. Core coaching logic in the unified bridge (TypeScript), audio analysis via Python helper scripts (librosa for reference track analysis). Commands exposed as MCP tools and natural language patterns in CLAUDE.md.

**Tech Stack:** TypeScript (unified-bridge), Python (librosa, madmom for audio analysis), MCP tools, existing audio_analysis.json from VST

---

## Task 1: Coaching Knowledge Base

**Files:**
- Create: `companions/unified-bridge/src/coaching/knowledge-base.ts`
- Create: `companions/unified-bridge/src/coaching/index.ts`

**Step 1: Create coaching directory structure**

```bash
mkdir -p companions/unified-bridge/src/coaching
```

**Step 2: Write the knowledge base module**

Create `companions/unified-bridge/src/coaching/knowledge-base.ts`:

```typescript
// Domain knowledge for techno/electronic music production coaching
// Pattern: symptom → root causes → specific fixes → explanations

export interface DiagnosticPattern {
  symptoms: string[];  // Keywords that trigger this pattern
  rootCauses: string[];
  fixes: ParameterFix[];
  explanation: string;
}

export interface ParameterFix {
  device: string;      // e.g., "Saturator", "Compressor", "EQ Eight"
  parameter: string;   // e.g., "Drive", "Ratio", "Frequency"
  range: [number, number] | string;  // e.g., [4, 8] for "4-8 dB" or "below 50 Hz"
  action: "set" | "reduce" | "increase" | "check";
}

export const DIAGNOSTIC_PATTERNS: DiagnosticPattern[] = [
  // Kick & Low End Issues
  {
    symptoms: ["muddy kick", "kick mud", "kick woofy", "kick not punchy"],
    rootCauses: [
      "Too much sub content overlapping with bass/rumble",
      "Kick reverb not EQ'd - low frequencies washing out",
      "FM synthesis amount too high (common with FM kicks)"
    ],
    fixes: [
      { device: "EQ Eight", parameter: "Low Cut", range: "50-60 Hz on rumble track", action: "set" },
      { device: "Utility", parameter: "Bass Mono", range: "below 120 Hz", action: "set" },
      { device: "Operator", parameter: "FM From B", range: [0.1, 0.2], action: "set" }
    ],
    explanation: "Kick and rumble fight for the same sub frequencies. Sculpt the rumble below 50-60 Hz to give the kick room. If using FM synthesis, keep modulation amount at 10-20%, not 60% (that produces woofy mud)."
  },
  {
    symptoms: ["kick disappears", "kick lost", "no kick punch", "kick buried"],
    rootCauses: [
      "Over-compression smashing transients",
      "Two limiters in series destroying dynamics",
      "Kick not sidechained properly"
    ],
    fixes: [
      { device: "Compressor", parameter: "Attack", range: [10, 30], action: "set" },
      { device: "Compressor", parameter: "Ratio", range: [2, 4], action: "set" },
      { device: "Limiter", parameter: "Gain", range: "check for multiple limiters", action: "check" }
    ],
    explanation: "Two limiters break because Limiter 1 smashes transients → Limiter 2 receives already-smashed waveform → It has nothing left to work with → Combined GR reaches 10-20 dB → Kick disappears. Solution: Delete the first limiter, or use Utility (-12 dB) before a single Limiter."
  },

  // High Frequency Issues
  {
    symptoms: ["harsh highs", "high end harsh", "hats too harsh", "presence painful"],
    rootCauses: [
      "Too much energy in 2-6 kHz presence band",
      "Resonant peaks from synthesis",
      "Over-saturated high frequencies"
    ],
    fixes: [
      { device: "EQ Eight", parameter: "High Shelf", range: "-2 to -4 dB above 6kHz", action: "set" },
      { device: "EQ Eight", parameter: "Bell at 3kHz", range: "narrow Q, -2 to -3 dB", action: "set" },
      { device: "Saturator", parameter: "Drive", range: [4, 8], action: "check" }
    ],
    explanation: "Hats should sit above everything else, crisp but not harsh. If they're painful, there's usually a resonant peak in the 2-6 kHz range. Use a narrow Q to notch it out rather than broad high-frequency reduction."
  },
  {
    symptoms: ["midrange hole", "hollow mids", "missing mids", "8-12k hole"],
    rootCauses: [
      "Destructive multiband limiting",
      "Phase cancellation between elements",
      "Over-aggressive high-pass filtering"
    ],
    fixes: [
      { device: "Multiband Dynamics", parameter: "High Band Ratio", range: "reduce to 2:1 or bypass", action: "set" },
      { device: "Utility", parameter: "Phase", range: "check for cancellation", action: "check" }
    ],
    explanation: "Huge midrange holes around 8-12 kHz usually come from destructive multiband limiting or phase cancellation. Check if multiple elements are fighting in that range. Try inverting phase on one element to test for cancellation."
  },

  // Dynamics Issues
  {
    symptoms: ["no dynamics", "too compressed", "flat dynamics", "lifeless"],
    rootCauses: [
      "Compressor ratio too high",
      "Attack too fast killing transients",
      "Multiple stages of compression stacking"
    ],
    fixes: [
      { device: "Compressor", parameter: "Ratio", range: [2, 4], action: "set" },
      { device: "Compressor", parameter: "Attack", range: [10, 50], action: "set" },
      { device: "Glue Compressor", parameter: "Range", range: "-6 dB max", action: "set" }
    ],
    explanation: "For techno, you want 3-6 dB crest factor (peak minus RMS). If it's lower, you're over-compressed. Check each compressor in the chain - combined gain reduction shouldn't exceed 6-8 dB total."
  },

  // Stereo/Width Issues
  {
    symptoms: ["mono collapse", "no width", "sounds narrow", "stereo weak"],
    rootCauses: [
      "Too many elements in mono",
      "Reverb returns summed to mono",
      "Stereo elements phase-cancelled in mono"
    ],
    fixes: [
      { device: "Utility", parameter: "Width", range: [100, 150], action: "check" },
      { device: "Utility", parameter: "Bass Mono", range: "below 120 Hz", action: "set" }
    ],
    explanation: "Kick & rumble should be mono. Synth + noise should be wide. If your mix collapses in mono, check your stereo elements for phase issues. Use Utility's 'Mono' button to A/B test mono compatibility."
  },

  // Saturation/Warmth
  {
    symptoms: ["too clean", "sterile", "needs warmth", "digital sounding"],
    rootCauses: [
      "No harmonic content added",
      "Over-reliance on clean digital processing"
    ],
    fixes: [
      { device: "Saturator", parameter: "Mode", range: "Analog Clip", action: "set" },
      { device: "Saturator", parameter: "Drive", range: [4, 8], action: "set" },
      { device: "Saturator", parameter: "Soft Clip", range: "ON", action: "set" }
    ],
    explanation: "Saturator settings for techno: Analog Clip mode, Drive +4 to +8 dB, Soft Clip ON, DC Filter ON. Match output to original loudness. This adds harmonic warmth without destroying transients."
  },

  // Reverb Issues
  {
    symptoms: ["reverb washy", "reverb mud", "wet mess", "reverb cloudy"],
    rootCauses: [
      "Reverb not EQ'd - low frequencies building up",
      "Reverb time too long",
      "Too many elements sent to same reverb"
    ],
    fixes: [
      { device: "EQ Eight", parameter: "High Pass", range: "200-400 Hz on reverb return", action: "set" },
      { device: "Reverb", parameter: "Decay Time", range: [1, 2.5], action: "set" }
    ],
    explanation: "Raw kick → reverb sounds like washy mess. Proper chain: Source → Reverb → EQ (high-pass at 200-400 Hz) → maybe light compression. Always EQ your reverb returns to remove low-end buildup."
  }
];

// Spectrum interpretation helpers
export const SPECTRUM_BANDS = {
  sub: { range: "20-60 Hz", role: "kick fundamental, sub bass" },
  bass: { range: "60-250 Hz", role: "kick body, bass notes" },
  lowMid: { range: "250-500 Hz", role: "bass harmonics, warmth, potential mud" },
  mid: { range: "500-2000 Hz", role: "body of most instruments" },
  upperMid: { range: "2000-4000 Hz", role: "presence, intelligibility" },
  presence: { range: "4000-6000 Hz", role: "attack, edge, potential harshness" },
  brilliance: { range: "6000-12000 Hz", role: "air, sparkle, hi-hats" },
  air: { range: "12000-20000 Hz", role: "shimmer, extreme highs" }
};

// Target values for techno
export const TECHNO_TARGETS = {
  masterLufs: { min: -11, max: -8, unit: "LUFS" },
  crestFactor: { min: 3, max: 6, unit: "dB" },
  subToBassDelta: { max: 6, unit: "dB", note: "sub shouldn't dominate bass by more than 6dB" }
};

export function findMatchingPatterns(symptomText: string): DiagnosticPattern[] {
  const lowerSymptom = symptomText.toLowerCase();
  return DIAGNOSTIC_PATTERNS.filter(pattern =>
    pattern.symptoms.some(s => lowerSymptom.includes(s))
  );
}
```

**Step 3: Create coaching index file**

Create `companions/unified-bridge/src/coaching/index.ts`:

```typescript
export * from './knowledge-base';
```

**Step 4: Run TypeScript compilation to verify**

```bash
cd companions/unified-bridge && npm run build
```
Expected: Compiles without errors

**Step 5: Commit**

```bash
git add companions/unified-bridge/src/coaching/
git commit -m "feat(coaching): add knowledge base with diagnostic patterns

Includes patterns for kick/low-end, high frequencies, dynamics,
stereo width, saturation, and reverb issues with specific fixes.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Device Chain Analyzer

**Files:**
- Create: `companions/unified-bridge/src/coaching/device-analyzer.ts`
- Modify: `companions/unified-bridge/src/coaching/index.ts`

**Step 1: Write device analyzer module**

Create `companions/unified-bridge/src/coaching/device-analyzer.ts`:

```typescript
import { AbletonClient } from '../ableton-client';

export interface DeviceChainAnalysis {
  trackName: string;
  trackIndex: number;
  devices: DeviceAnalysis[];
  issues: string[];
  suggestions: string[];
}

export interface DeviceAnalysis {
  name: string;
  type: string;
  index: number;
  parameters: ParameterState[];
  issues: string[];
}

export interface ParameterState {
  name: string;
  value: number;
  normalizedValue: number;
  min: number;
  max: number;
}

// Known problematic parameter combinations
const ISSUE_DETECTORS: Array<{
  device: string;
  check: (params: Map<string, number>) => string | null;
}> = [
  {
    device: "Compressor",
    check: (params) => {
      const ratio = params.get("Ratio");
      const attack = params.get("Attack");
      if (ratio && ratio > 8) return `Compressor ratio at ${ratio}:1 is very high - consider 2-4:1 for techno`;
      if (attack && attack < 5) return `Attack at ${attack}ms is killing transients - try 10-30ms`;
      return null;
    }
  },
  {
    device: "Limiter",
    check: (params) => {
      const gain = params.get("Gain");
      if (gain && gain > 12) return `Limiter gain at ${gain}dB is extreme - check for cascading limiters`;
      return null;
    }
  },
  {
    device: "Saturator",
    check: (params) => {
      const drive = params.get("Drive");
      if (drive && drive > 20) return `Saturator drive at ${drive}dB is very aggressive`;
      return null;
    }
  },
  {
    device: "EQ Eight",
    check: (params) => {
      // Check for extreme boosts
      for (const [name, value] of params) {
        if (name.includes("Gain") && Math.abs(value) > 8) {
          return `EQ ${name} at ${value > 0 ? '+' : ''}${value}dB is extreme - try smaller moves`;
        }
      }
      return null;
    }
  },
  {
    device: "Operator",
    check: (params) => {
      // FM amount check
      const fmB = params.get("FM From B") || params.get("B Level");
      if (fmB && fmB > 0.5) return `FM modulation amount is high (${Math.round(fmB * 100)}%) - can cause mud`;
      return null;
    }
  }
];

export async function analyzeDeviceChain(
  client: AbletonClient,
  trackIndex: number
): Promise<DeviceChainAnalysis> {
  const trackInfo = await client.sendCommand('get_track_info', { track_index: trackIndex });

  const analysis: DeviceChainAnalysis = {
    trackName: trackInfo.name,
    trackIndex,
    devices: [],
    issues: [],
    suggestions: []
  };

  // Check for multiple compressors/limiters
  let compressorCount = 0;
  let limiterCount = 0;

  for (let i = 0; i < (trackInfo.devices?.length || 0); i++) {
    const deviceInfo = trackInfo.devices[i];
    const params = await client.sendCommand('get_device_parameters', {
      track_index: trackIndex,
      device_index: i
    });

    const deviceAnalysis: DeviceAnalysis = {
      name: deviceInfo.name,
      type: deviceInfo.class_name || deviceInfo.name,
      index: i,
      parameters: params.parameters?.map((p: any) => ({
        name: p.name,
        value: p.value,
        normalizedValue: p.normalized_value,
        min: p.min,
        max: p.max
      })) || [],
      issues: []
    };

    // Count dynamics processors
    if (deviceInfo.name.includes("Compressor") || deviceInfo.name.includes("Glue")) {
      compressorCount++;
    }
    if (deviceInfo.name.includes("Limiter")) {
      limiterCount++;
    }

    // Run issue detectors
    const paramMap = new Map<string, number>();
    deviceAnalysis.parameters.forEach(p => paramMap.set(p.name, p.value));

    for (const detector of ISSUE_DETECTORS) {
      if (deviceInfo.name.includes(detector.device) || deviceInfo.class_name?.includes(detector.device)) {
        const issue = detector.check(paramMap);
        if (issue) {
          deviceAnalysis.issues.push(issue);
          analysis.issues.push(`${deviceInfo.name}: ${issue}`);
        }
      }
    }

    analysis.devices.push(deviceAnalysis);
  }

  // Chain-level analysis
  if (compressorCount > 2) {
    analysis.issues.push(`${compressorCount} compressors in chain - watch for over-compression`);
  }
  if (limiterCount > 1) {
    analysis.issues.push(`${limiterCount} limiters in series - this often destroys dynamics`);
    analysis.suggestions.push("Consider removing one limiter and using Utility for gain staging");
  }

  return analysis;
}

export function formatAnalysisForCoaching(analysis: DeviceChainAnalysis): string {
  let output = `## Track: ${analysis.trackName}\n\n`;

  output += `**Device Chain:** ${analysis.devices.map(d => d.name).join(' → ')}\n\n`;

  if (analysis.issues.length > 0) {
    output += `**Issues Found:**\n`;
    analysis.issues.forEach(issue => {
      output += `- ${issue}\n`;
    });
    output += '\n';
  }

  if (analysis.suggestions.length > 0) {
    output += `**Suggestions:**\n`;
    analysis.suggestions.forEach(s => {
      output += `- ${s}\n`;
    });
  }

  if (analysis.issues.length === 0) {
    output += `No obvious issues detected in device chain.\n`;
  }

  return output;
}
```

**Step 2: Update coaching index**

Edit `companions/unified-bridge/src/coaching/index.ts`:

```typescript
export * from './knowledge-base';
export * from './device-analyzer';
```

**Step 3: Run TypeScript compilation**

```bash
cd companions/unified-bridge && npm run build
```
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add companions/unified-bridge/src/coaching/
git commit -m "feat(coaching): add device chain analyzer

Analyzes track device chains for common issues:
- Over-compression (ratio, attack times)
- Multiple limiters in series
- Extreme EQ boosts
- High FM modulation amounts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Coaching MCP Tools

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts`

**Step 1: Add coaching tool imports**

At the top of `mcp-server.ts`, add:

```typescript
import { findMatchingPatterns, SPECTRUM_BANDS, TECHNO_TARGETS, DiagnosticPattern } from './coaching/knowledge-base';
import { analyzeDeviceChain, formatAnalysisForCoaching } from './coaching/device-analyzer';
```

**Step 2: Add diagnose_sound_issue tool**

Add to the tools section:

```typescript
server.tool(
  'diagnose_sound_issue',
  'Diagnose a sound issue using device parameters and audio analysis. Describe the symptom (e.g., "kick sounds muddy", "harsh highs")',
  {
    symptom: z.string().describe('Description of what sounds wrong'),
    track_index: z.number().optional().describe('Track to analyze (optional, analyzes all if not specified)'),
  },
  async ({ symptom, track_index }) => {
    let output = `# Sound Diagnosis: "${symptom}"\n\n`;

    // Find matching diagnostic patterns
    const patterns = findMatchingPatterns(symptom);

    if (patterns.length > 0) {
      output += `## Likely Causes\n\n`;
      patterns.forEach((pattern, i) => {
        output += `### ${i + 1}. ${pattern.rootCauses[0]}\n\n`;
        output += `**Other possible causes:**\n`;
        pattern.rootCauses.slice(1).forEach(cause => {
          output += `- ${cause}\n`;
        });
        output += `\n**Recommended fixes:**\n`;
        pattern.fixes.forEach(fix => {
          const rangeStr = Array.isArray(fix.range)
            ? `${fix.range[0]}-${fix.range[1]}`
            : fix.range;
          output += `- ${fix.device} → ${fix.parameter}: ${fix.action} to ${rangeStr}\n`;
        });
        output += `\n**Why this works:** ${pattern.explanation}\n\n`;
      });
    } else {
      output += `No specific patterns matched. Let me analyze your device chain...\n\n`;
    }

    // Analyze device chain if track specified
    if (track_index !== undefined) {
      try {
        const analysis = await analyzeDeviceChain(client, track_index);
        output += formatAnalysisForCoaching(analysis);
      } catch (e) {
        output += `Could not analyze track ${track_index}: ${e}\n`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  }
);
```

**Step 3: Add analyze_track_chain tool**

```typescript
server.tool(
  'analyze_track_chain',
  'Analyze device chain on a track for potential issues',
  {
    track_index: z.number().describe('Track index to analyze'),
  },
  async ({ track_index }) => {
    const analysis = await analyzeDeviceChain(client, track_index);
    return { content: [{ type: 'text', text: formatAnalysisForCoaching(analysis) }] };
  }
);
```

**Step 4: Add compare_to_target tool**

```typescript
server.tool(
  'compare_to_target',
  'Compare current audio analysis to techno production targets',
  {
    analysis_json: z.string().describe('Contents of audio_analysis.json'),
  },
  async ({ analysis_json }) => {
    const analysis = JSON.parse(analysis_json);
    let output = `# Mix Analysis vs Techno Targets\n\n`;

    // Levels
    const rmsAvg = (analysis.levels.rms_left_db + analysis.levels.rms_right_db) / 2;
    const peakAvg = (analysis.levels.peak_left_db + analysis.levels.peak_right_db) / 2;
    const crest = analysis.levels.crest_factor_db;

    output += `## Dynamics\n`;
    output += `- **RMS Level:** ${rmsAvg.toFixed(1)} dB\n`;
    output += `- **Peak Level:** ${peakAvg.toFixed(1)} dB\n`;
    output += `- **Crest Factor:** ${crest.toFixed(1)} dB `;

    if (crest < TECHNO_TARGETS.crestFactor.min) {
      output += `⚠️ Too compressed (target: ${TECHNO_TARGETS.crestFactor.min}-${TECHNO_TARGETS.crestFactor.max} dB)\n`;
    } else if (crest > TECHNO_TARGETS.crestFactor.max) {
      output += `(very dynamic for techno)\n`;
    } else {
      output += `✓ Good for techno\n`;
    }

    // Spectrum balance
    output += `\n## Spectrum\n`;
    const spectrum = analysis.spectrum;

    output += `| Band | Level | Notes |\n`;
    output += `|------|-------|-------|\n`;

    const bands = [
      ['Sub (20-60Hz)', spectrum.sub_db, SPECTRUM_BANDS.sub.role],
      ['Bass (60-250Hz)', spectrum.bass_db, SPECTRUM_BANDS.bass.role],
      ['Low-Mid (250-500Hz)', spectrum.low_mid_db, SPECTRUM_BANDS.lowMid.role],
      ['Mid (500-2kHz)', spectrum.mid_db, SPECTRUM_BANDS.mid.role],
      ['Upper-Mid (2-4kHz)', spectrum.upper_mid_db, SPECTRUM_BANDS.upperMid.role],
      ['Presence (4-6kHz)', spectrum.presence_db, SPECTRUM_BANDS.presence.role],
      ['Brilliance (6-12kHz)', spectrum.brilliance_db, SPECTRUM_BANDS.brilliance.role],
      ['Air (12-20kHz)', spectrum.air_db, SPECTRUM_BANDS.air.role],
    ];

    bands.forEach(([name, level, role]) => {
      output += `| ${name} | ${(level as number).toFixed(1)} dB | ${role} |\n`;
    });

    // Sub to bass ratio check
    const subBassDelta = spectrum.sub_db - spectrum.bass_db;
    if (subBassDelta > TECHNO_TARGETS.subToBassDelta.max) {
      output += `\n⚠️ Sub is ${subBassDelta.toFixed(1)} dB louder than bass - may cause mud on some systems\n`;
    }

    return { content: [{ type: 'text', text: output }] };
  }
);
```

**Step 5: Build and test**

```bash
cd companions/unified-bridge && npm run build
```
Expected: Compiles without errors

**Step 6: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts
git commit -m "feat(coaching): add MCP tools for sound diagnosis

New tools:
- diagnose_sound_issue: Match symptoms to fixes
- analyze_track_chain: Detect device chain issues
- compare_to_target: Compare mix to techno targets

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Reference Track Analyzer (Python)

**Files:**
- Create: `companions/audio-analysis/requirements.txt`
- Create: `companions/audio-analysis/reference_analyzer.py`
- Create: `companions/audio-analysis/README.md`

**Step 1: Create directory and requirements**

```bash
mkdir -p companions/audio-analysis
```

Create `companions/audio-analysis/requirements.txt`:

```
librosa>=0.10.0
numpy>=1.24.0
scipy>=1.10.0
```

**Step 2: Write reference analyzer**

Create `companions/audio-analysis/reference_analyzer.py`:

```python
#!/usr/bin/env python3
"""
Reference Track Analyzer
Extracts structure (sections + energy curve) from audio files.
Called by unified-bridge for reference track workflow.
"""

import json
import sys
import argparse
from pathlib import Path

import numpy as np
import librosa


def detect_bpm(y: np.ndarray, sr: int) -> float:
    """Detect BPM of audio."""
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    return float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)


def extract_energy_curve(y: np.ndarray, sr: int, hop_length: int = 512) -> list[dict]:
    """Extract energy over time, normalized to 0-100."""
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    # Convert to dB, normalize
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)
    rms_normalized = ((rms_db - rms_db.min()) / (rms_db.max() - rms_db.min()) * 100)

    # Downsample to ~1 point per second
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    # Sample every ~1 second
    step = max(1, int(sr / hop_length))

    return [
        {"time": float(times[i]), "energy": float(rms_normalized[i])}
        for i in range(0, len(times), step)
    ]


def detect_sections(y: np.ndarray, sr: int, bpm: float) -> list[dict]:
    """
    Detect structural sections using spectral clustering.
    Returns sections with bar positions and energy levels.
    """
    # Compute beat-synchronous features
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Compute chromagram and MFCCs
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # Beat-sync features
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    mfcc_sync = librosa.util.sync(mfcc, beat_frames, aggregate=np.median)

    # Stack features
    features = np.vstack([chroma_sync, mfcc_sync])

    # Compute self-similarity matrix
    recurrence = librosa.segment.recurrence_matrix(
        features,
        mode='affinity',
        sym=True
    )

    # Detect segment boundaries using spectral clustering
    try:
        bounds = librosa.segment.agglomerative(features, k=8)  # ~8 sections typical for techno
    except Exception:
        # Fallback: equal divisions
        n_beats = len(beat_times)
        bounds = np.linspace(0, n_beats - 1, 9, dtype=int)

    # Convert to time and bars
    sections = []
    beats_per_bar = 4

    for i in range(len(bounds) - 1):
        start_beat = bounds[i]
        end_beat = bounds[i + 1]

        start_time = beat_times[start_beat] if start_beat < len(beat_times) else 0
        end_time = beat_times[end_beat] if end_beat < len(beat_times) else beat_times[-1]

        # Calculate energy in this section
        start_sample = librosa.time_to_samples(start_time, sr=sr)
        end_sample = librosa.time_to_samples(end_time, sr=sr)
        section_audio = y[start_sample:end_sample]

        if len(section_audio) > 0:
            section_rms = np.sqrt(np.mean(section_audio ** 2))
            section_energy = librosa.amplitude_to_db([section_rms], ref=np.max(np.abs(y)))[0]
            # Normalize to 0-100
            energy_normalized = max(0, min(100, (section_energy + 60) / 60 * 100))
        else:
            energy_normalized = 0

        bars = int((end_beat - start_beat) / beats_per_bar)

        sections.append({
            "index": i,
            "start_time": round(start_time, 2),
            "end_time": round(end_time, 2),
            "start_bar": start_beat // beats_per_bar,
            "bars": max(1, bars),
            "energy": round(energy_normalized, 1),
            "label": f"Section {i + 1}"
        })

    # Label sections based on energy
    if sections:
        max_energy = max(s["energy"] for s in sections)
        min_energy = min(s["energy"] for s in sections)

        for s in sections:
            rel_energy = (s["energy"] - min_energy) / (max_energy - min_energy + 0.01)
            if rel_energy > 0.8:
                s["label"] = "Drop/Peak"
            elif rel_energy > 0.5:
                s["label"] = "Build/Plateau"
            elif rel_energy > 0.3:
                s["label"] = "Breakdown"
            else:
                s["label"] = "Intro/Outro"

    return sections


def analyze_spectrum_profile(y: np.ndarray, sr: int) -> dict:
    """Get average spectrum profile for comparison."""
    # Compute spectrum
    D = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)

    # Average over time
    avg_spectrum = np.mean(D, axis=1)
    avg_spectrum_db = librosa.amplitude_to_db(avg_spectrum, ref=np.max)

    # Band energies (matching VST bands)
    bands = {
        "sub": (20, 60),
        "bass": (60, 250),
        "low_mid": (250, 500),
        "mid": (500, 2000),
        "upper_mid": (2000, 4000),
        "presence": (4000, 6000),
        "brilliance": (6000, 12000),
        "air": (12000, 20000)
    }

    result = {}
    for name, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs < high)
        if mask.any():
            band_energy = np.mean(avg_spectrum_db[mask])
            result[f"{name}_db"] = round(float(band_energy), 1)
        else:
            result[f"{name}_db"] = -60.0

    return result


def analyze_reference(file_path: str) -> dict:
    """
    Full analysis of a reference track.
    Returns BPM, sections, energy curve, and spectrum profile.
    """
    print(f"Loading {file_path}...", file=sys.stderr)
    y, sr = librosa.load(file_path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    print("Detecting BPM...", file=sys.stderr)
    bpm = detect_bpm(y, sr)

    print("Extracting sections...", file=sys.stderr)
    sections = detect_sections(y, sr, bpm)

    print("Computing energy curve...", file=sys.stderr)
    energy_curve = extract_energy_curve(y, sr)

    print("Analyzing spectrum...", file=sys.stderr)
    spectrum = analyze_spectrum_profile(y, sr)

    return {
        "file": str(Path(file_path).name),
        "duration_seconds": round(duration, 2),
        "bpm": round(bpm, 1),
        "sections": sections,
        "energy_curve": energy_curve,
        "spectrum_profile": spectrum
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze reference track structure")
    parser.add_argument("file", help="Path to audio file")
    parser.add_argument("--output", "-o", help="Output JSON file (default: stdout)")

    args = parser.parse_args()

    if not Path(args.file).exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    result = analyze_reference(args.file)

    output = json.dumps(result, indent=2)

    if args.output:
        Path(args.output).write_text(output)
        print(f"Analysis saved to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
```

**Step 3: Create README**

Create `companions/audio-analysis/README.md`:

```markdown
# Audio Analysis Tools

Python-based audio analysis for ClaudeVST coaching system.

## Setup

```bash
cd companions/audio-analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Reference Track Analyzer

Extracts structure (sections + energy curve) from audio files.

```bash
python reference_analyzer.py /path/to/reference.wav

# Output to file
python reference_analyzer.py /path/to/reference.wav -o analysis.json
```

### Output Format

```json
{
  "file": "reference.wav",
  "duration_seconds": 360.0,
  "bpm": 128.0,
  "sections": [
    {
      "index": 0,
      "start_time": 0.0,
      "end_time": 32.0,
      "start_bar": 0,
      "bars": 16,
      "energy": 45.2,
      "label": "Intro/Outro"
    }
  ],
  "energy_curve": [
    {"time": 0.0, "energy": 45.2},
    {"time": 1.0, "energy": 48.1}
  ],
  "spectrum_profile": {
    "sub_db": -12.5,
    "bass_db": -8.2
  }
}
```
```

**Step 4: Test the analyzer (if audio file available)**

```bash
cd companions/audio-analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Test with any audio file you have
```

**Step 5: Commit**

```bash
git add companions/audio-analysis/
git commit -m "feat(coaching): add reference track analyzer

Python tool using librosa for:
- BPM detection
- Structure/section detection via spectral clustering
- Energy curve extraction
- Spectrum profile for comparison

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Reference Track MCP Integration

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts`
- Create: `companions/unified-bridge/src/coaching/reference-track.ts`

**Step 1: Create reference track module**

Create `companions/unified-bridge/src/coaching/reference-track.ts`:

```typescript
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface ReferenceAnalysis {
  file: string;
  duration_seconds: number;
  bpm: number;
  sections: Section[];
  energy_curve: EnergyPoint[];
  spectrum_profile: Record<string, number>;
}

export interface Section {
  index: number;
  start_time: number;
  end_time: number;
  start_bar: number;
  bars: number;
  energy: number;
  label: string;
}

export interface EnergyPoint {
  time: number;
  energy: number;
}

const ANALYZER_PATH = path.join(__dirname, '../../..', 'audio-analysis', 'reference_analyzer.py');
const VENV_PYTHON = path.join(__dirname, '../../..', 'audio-analysis', 'venv', 'bin', 'python3');

export async function analyzeReferenceTrack(filePath: string): Promise<ReferenceAnalysis> {
  return new Promise((resolve, reject) => {
    // Use venv python if available, otherwise system python
    const pythonPath = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';

    const proc = spawn(pythonPath, [ANALYZER_PATH, filePath]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress to console (stderr is used for progress)
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Analyzer failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse analyzer output: ${e}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn analyzer: ${err.message}`));
    });
  });
}

export function formatSectionsAsMarkers(analysis: ReferenceAnalysis): string {
  let output = `# Reference: ${analysis.file}\n\n`;
  output += `**BPM:** ${analysis.bpm}\n`;
  output += `**Duration:** ${Math.floor(analysis.duration_seconds / 60)}:${Math.round(analysis.duration_seconds % 60).toString().padStart(2, '0')}\n\n`;

  output += `## Sections\n\n`;
  output += `| # | Label | Bars | Start | Energy |\n`;
  output += `|---|-------|------|-------|--------|\n`;

  analysis.sections.forEach(s => {
    const mins = Math.floor(s.start_time / 60);
    const secs = Math.round(s.start_time % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const energyBar = '█'.repeat(Math.round(s.energy / 10)) + '░'.repeat(10 - Math.round(s.energy / 10));
    output += `| ${s.index + 1} | ${s.label} | ${s.bars} | ${timeStr} | ${energyBar} ${s.energy.toFixed(0)}% |\n`;
  });

  return output;
}

export function generateArrangementScaffold(
  analysis: ReferenceAnalysis,
  sessionBpm: number
): string {
  // Calculate tempo ratio for time adjustments
  const tempoRatio = sessionBpm / analysis.bpm;

  let output = `# Arrangement Scaffold\n\n`;
  output += `Reference BPM: ${analysis.bpm} → Session BPM: ${sessionBpm}\n`;

  if (Math.abs(tempoRatio - 1) > 0.1) {
    output += `⚠️ Tempo difference >10% - section times will be adjusted\n`;
  }

  output += `\n## Marker Placement\n\n`;
  output += `Place arrangement markers at these positions:\n\n`;

  analysis.sections.forEach(s => {
    const adjustedBar = Math.round(s.start_bar * tempoRatio);
    output += `- **Bar ${adjustedBar}:** ${s.label} (${s.bars} bars, energy: ${s.energy.toFixed(0)}%)\n`;
  });

  output += `\n## Energy Target by Section\n\n`;
  output += `Use these energy levels as mixing targets:\n\n`;

  const peakEnergy = Math.max(...analysis.sections.map(s => s.energy));
  analysis.sections.forEach(s => {
    const relEnergy = (s.energy / peakEnergy * 100).toFixed(0);
    output += `- ${s.label}: ${relEnergy}% of peak\n`;
  });

  return output;
}
```

**Step 2: Update coaching index**

Edit `companions/unified-bridge/src/coaching/index.ts`:

```typescript
export * from './knowledge-base';
export * from './device-analyzer';
export * from './reference-track';
```

**Step 3: Add reference track MCP tools**

Add to `companions/unified-bridge/src/mcp-server.ts`:

```typescript
import { analyzeReferenceTrack, formatSectionsAsMarkers, generateArrangementScaffold } from './coaching/reference-track';

// In the tools section:

server.tool(
  'analyze_reference_track',
  'Analyze a reference track to extract structure (sections + energy curve) and BPM. Returns sections with labels like "Drop/Peak", "Build", "Breakdown".',
  {
    file_path: z.string().describe('Absolute path to audio file (wav, mp3, etc.)'),
  },
  async ({ file_path }) => {
    try {
      const analysis = await analyzeReferenceTrack(file_path);
      const formatted = formatSectionsAsMarkers(analysis);

      // Also include raw data for programmatic use
      const output = formatted + '\n\n---\n\n```json\n' + JSON.stringify(analysis, null, 2) + '\n```';

      return { content: [{ type: 'text', text: output }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error analyzing reference: ${e}` }] };
    }
  }
);

server.tool(
  'generate_arrangement_scaffold',
  'Generate arrangement marker positions based on reference track analysis. Adjusts for tempo differences.',
  {
    file_path: z.string().describe('Path to reference audio file'),
    session_bpm: z.number().describe('Current session BPM'),
  },
  async ({ file_path, session_bpm }) => {
    try {
      const analysis = await analyzeReferenceTrack(file_path);
      const scaffold = generateArrangementScaffold(analysis, session_bpm);
      return { content: [{ type: 'text', text: scaffold }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error generating scaffold: ${e}` }] };
    }
  }
);

server.tool(
  'compare_mix_to_reference',
  'Compare current mix spectrum/dynamics to a reference track',
  {
    reference_path: z.string().describe('Path to reference audio file'),
    current_analysis: z.string().describe('Contents of audio_analysis.json from VST'),
  },
  async ({ reference_path, current_analysis }) => {
    try {
      const refAnalysis = await analyzeReferenceTrack(reference_path);
      const current = JSON.parse(current_analysis);

      let output = `# Mix Comparison: Your Mix vs Reference\n\n`;
      output += `## Spectrum Comparison\n\n`;
      output += `| Band | Your Mix | Reference | Difference |\n`;
      output += `|------|----------|-----------|------------|\n`;

      const bands = ['sub', 'bass', 'low_mid', 'mid', 'upper_mid', 'presence', 'brilliance', 'air'];
      bands.forEach(band => {
        const yourLevel = current.spectrum[`${band}_db`];
        const refLevel = refAnalysis.spectrum_profile[`${band}_db`];
        const diff = yourLevel - refLevel;
        const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
        const indicator = Math.abs(diff) > 3 ? (diff > 0 ? '⬆️' : '⬇️') : '≈';

        output += `| ${band} | ${yourLevel.toFixed(1)} dB | ${refLevel.toFixed(1)} dB | ${diffStr} dB ${indicator} |\n`;
      });

      output += `\n## Key Differences\n\n`;

      // Find biggest differences
      const diffs = bands.map(band => ({
        band,
        diff: current.spectrum[`${band}_db`] - refAnalysis.spectrum_profile[`${band}_db`]
      })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

      diffs.slice(0, 3).forEach(({ band, diff }) => {
        if (Math.abs(diff) > 2) {
          const direction = diff > 0 ? 'louder' : 'quieter';
          output += `- **${band}** is ${Math.abs(diff).toFixed(1)} dB ${direction} than reference\n`;
        }
      });

      if (diffs.every(d => Math.abs(d.diff) <= 2)) {
        output += `Your spectrum is well-matched to the reference!\n`;
      }

      return { content: [{ type: 'text', text: output }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error comparing: ${e}` }] };
    }
  }
);
```

**Step 4: Build and verify**

```bash
cd companions/unified-bridge && npm run build
```

**Step 5: Commit**

```bash
git add companions/unified-bridge/src/coaching/ companions/unified-bridge/src/mcp-server.ts
git commit -m "feat(coaching): add reference track MCP tools

New tools:
- analyze_reference_track: Extract sections + energy + BPM
- generate_arrangement_scaffold: Create marker positions
- compare_mix_to_reference: A/B spectrum comparison

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Hybrid Command Interface (CLAUDE.md)

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add coaching section to CLAUDE.md**

Add after the "Message Handling Best Practices" section:

```markdown
---

## Sound Design Coaching

ClaudeVST includes a coaching system for sound design and mixing feedback.

### Natural Language (Default)

Just ask questions about sound issues:
- "Why does my kick sound muddy?"
- "My high end sounds harsh, what's wrong?"
- "The mix sounds lifeless and flat"

Claude will:
1. Match symptoms to known diagnostic patterns
2. Read device chains to find specific issues
3. Provide fixes with parameter values
4. Explain WHY each fix works

### Explicit Commands (For Expensive Operations)

Use these for operations that take time or many tokens:

| Command | Purpose |
|---------|---------|
| `/analyze-ref <path>` | Analyze reference track structure |
| `/compare-ref <path>` | Compare current mix to reference |
| `/scaffold <path>` | Generate arrangement markers from reference |

Example workflow:
```
/analyze-ref ~/Music/References/track.wav
# Returns sections, BPM, energy curve

/scaffold ~/Music/References/track.wav
# Returns marker positions adjusted for your session BPM
```

### Available MCP Tools

| Tool | Use Case |
|------|----------|
| `diagnose_sound_issue` | Symptom → root causes → fixes |
| `analyze_track_chain` | Device chain audit for issues |
| `compare_to_target` | Mix vs techno production targets |
| `analyze_reference_track` | Reference structure extraction |
| `compare_mix_to_reference` | A/B spectrum comparison |

### Coaching Response Pattern

Good coaching follows this pattern:

1. **Acknowledge the symptom** - "I hear that your kick sounds muddy..."
2. **Identify likely causes** - "This usually happens because..."
3. **Give specific fixes** - "Set EQ Eight high-pass to 50 Hz on the rumble track"
4. **Explain why** - "This works because kick and rumble compete for sub frequencies"

### Token Efficiency

**DO NOT:**
- Query full browser tree (returns 131k chars)
- Repeatedly poll session info (use delta tools)
- Analyze reference tracks without explicit request

**DO:**
- Use `get_session_delta` instead of `get_session_info`
- Use `get_parameter_by_name` instead of fetching all params
- Cache reference analysis results
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add sound design coaching section to CLAUDE.md

Documents:
- Natural language coaching interface
- Explicit commands for expensive operations
- Available MCP tools
- Response patterns and token efficiency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Token Efficiency Guards

**Files:**
- Modify: `companions/unified-bridge/src/mcp-server.ts`

**Step 1: Add browser query guard**

In `mcp-server.ts`, modify the `get_browser_tree` tool to add a warning:

```typescript
server.tool(
  'get_browser_tree',
  '⚠️ EXPENSIVE: Returns full browser tree (can be 100k+ tokens). Use get_browser_items_at_path instead for targeted browsing.',
  {
    category_type: z.string().default('all').describe('Category type (instruments, sounds, drums, audio_effects, midi_effects, all)'),
  },
  async ({ category_type }) => {
    // Add size warning
    const result = await client.sendCommand('get_browser_tree', { category_type });
    const resultStr = JSON.stringify(result);

    if (resultStr.length > 50000) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ WARNING: Browser tree is ${Math.round(resultStr.length / 1000)}k characters. Consider using get_browser_items_at_path for targeted browsing.\n\n` + resultStr
        }]
      };
    }

    return { content: [{ type: 'text', text: resultStr }] };
  }
);
```

**Step 2: Add delta usage reminder to full-state tools**

Modify `get_session_info` tool description:

```typescript
server.tool(
  'get_session_info',
  'Get full session state. ⚡ Prefer get_session_delta for repeated queries (85-95% token savings).',
  // ... rest of implementation
);
```

Similarly for `get_track_info` and `get_device_parameters`.

**Step 3: Build and verify**

```bash
cd companions/unified-bridge && npm run build
```

**Step 4: Commit**

```bash
git add companions/unified-bridge/src/mcp-server.ts
git commit -m "perf: add token efficiency guards to MCP tools

- Warn when browser tree exceeds 50k chars
- Add delta recommendations to full-state tool descriptions
- Guide users toward efficient patterns

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `docs/UNIFIED_BRIDGE.md`

**Step 1: Add coaching tools section**

Add to the MCP Tools section in `docs/UNIFIED_BRIDGE.md`:

```markdown
### Coaching Tools

| Tool | Description |
|------|-------------|
| `diagnose_sound_issue` | Match symptoms to diagnostic patterns and fixes |
| `analyze_track_chain` | Audit device chain for common issues |
| `compare_to_target` | Compare mix to techno production targets |

### Reference Track Tools

| Tool | Description |
|------|-------------|
| `analyze_reference_track` | Extract BPM, sections, energy curve from audio |
| `generate_arrangement_scaffold` | Create marker positions from reference |
| `compare_mix_to_reference` | A/B spectrum comparison |
```

**Step 2: Add REST endpoints**

```markdown
### Coaching
```
POST /coaching/diagnose          - Diagnose sound issue {"symptom": "kick muddy"}
GET  /coaching/analyze/:track    - Analyze track device chain
POST /coaching/compare-target    - Compare to techno targets {"analysis": {...}}
```

### Reference Tracks
```
POST /reference/analyze          - Analyze reference {"file_path": "/path/to/file.wav"}
POST /reference/scaffold         - Generate scaffold {"file_path": "...", "session_bpm": 128}
POST /reference/compare          - Compare mix {"reference_path": "...", "current_analysis": {...}}
```
```

**Step 3: Commit**

```bash
git add docs/UNIFIED_BRIDGE.md
git commit -m "docs: add coaching and reference track tools to UNIFIED_BRIDGE.md

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Integration Test

**Files:**
- Create: `companions/unified-bridge/test/coaching.test.ts`

**Step 1: Create test file**

Create `companions/unified-bridge/test/coaching.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findMatchingPatterns, DIAGNOSTIC_PATTERNS } from '../src/coaching/knowledge-base';

describe('Coaching Knowledge Base', () => {
  describe('findMatchingPatterns', () => {
    it('finds kick mud patterns', () => {
      const patterns = findMatchingPatterns('my kick sounds muddy');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].symptoms).toContain('muddy kick');
    });

    it('finds harsh highs patterns', () => {
      const patterns = findMatchingPatterns('the high end is too harsh');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].symptoms.some(s => s.includes('harsh'))).toBe(true);
    });

    it('finds compression patterns', () => {
      const patterns = findMatchingPatterns('mix sounds lifeless and flat');
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('returns empty for unknown symptoms', () => {
      const patterns = findMatchingPatterns('the purple sounds too yellow');
      expect(patterns.length).toBe(0);
    });
  });

  describe('DIAGNOSTIC_PATTERNS', () => {
    it('all patterns have required fields', () => {
      DIAGNOSTIC_PATTERNS.forEach(pattern => {
        expect(pattern.symptoms.length).toBeGreaterThan(0);
        expect(pattern.rootCauses.length).toBeGreaterThan(0);
        expect(pattern.fixes.length).toBeGreaterThan(0);
        expect(pattern.explanation).toBeTruthy();
      });
    });

    it('all fixes have valid structure', () => {
      DIAGNOSTIC_PATTERNS.forEach(pattern => {
        pattern.fixes.forEach(fix => {
          expect(fix.device).toBeTruthy();
          expect(fix.parameter).toBeTruthy();
          expect(fix.range).toBeDefined();
          expect(['set', 'reduce', 'increase', 'check']).toContain(fix.action);
        });
      });
    });
  });
});
```

**Step 2: Run tests**

```bash
cd companions/unified-bridge && npm test
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add companions/unified-bridge/test/
git commit -m "test: add coaching knowledge base tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Deploy and Verify End-to-End

**Step 1: Rebuild unified bridge**

```bash
cd companions/unified-bridge
npm run build
```

**Step 2: Install Python dependencies for reference analyzer**

```bash
cd companions/audio-analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 3: Restart MCP server**

Kill any existing unified-bridge process and restart Claude Code to pick up new tools.

**Step 4: Verify coaching tools work**

In Claude Code, try:
```
Use the diagnose_sound_issue tool with symptom "kick sounds muddy"
```

Expected: Returns diagnostic patterns with fixes and explanations.

**Step 5: Test reference analyzer (if you have an audio file)**

```bash
cd companions/audio-analysis
source venv/bin/activate
python reference_analyzer.py /path/to/any/audio.wav
```

Expected: JSON output with BPM, sections, energy curve.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(coaching): complete sound design coaching system

Full implementation of:
- Knowledge base with techno-specific diagnostic patterns
- Device chain analyzer for issue detection
- Reference track analyzer (Python/librosa)
- MCP tools for diagnosis, comparison, scaffolding
- Token efficiency guards
- CLAUDE.md documentation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

This plan implements the full sound design coaching vision:

1. **Coaching Knowledge Base** - Symptom → causes → fixes → explanations
2. **Device Chain Analyzer** - Automatic issue detection
3. **MCP Tools** - `diagnose_sound_issue`, `analyze_track_chain`, `compare_to_target`
4. **Reference Track Analyzer** - Python/librosa for BPM, sections, energy
5. **Reference MCP Tools** - `analyze_reference_track`, `generate_arrangement_scaffold`, `compare_mix_to_reference`
6. **Hybrid Interface** - Natural language + explicit commands
7. **Token Efficiency** - Guards and delta recommendations
8. **Documentation** - CLAUDE.md updates

Total estimated tasks: 10
Each task is independently testable and committable.
