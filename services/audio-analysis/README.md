# Reference Track Analyzer

Python tool for analyzing reference tracks to support ClaudeVST sound design coaching.

## Features

- **BPM Detection** - Automatic tempo detection using beat tracking
- **Section Detection** - Identifies song structure via spectral clustering
- **Energy Curve** - Normalized loudness envelope (0-100 scale)
- **Spectrum Profile** - Frequency band analysis matching VST bands

## Setup

```bash
cd companions/audio-analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Usage

Analyze a reference track:

```bash
python reference_analyzer.py track.wav
```

Save output to file:

```bash
python reference_analyzer.py track.wav -o analysis.json
```

## Output Format

```json
{
  "file": "/path/to/track.wav",
  "duration_seconds": 245.5,
  "bpm": 128.0,
  "sections": [
    {"index": 0, "start_seconds": 0, "end_seconds": 32.5, "duration_seconds": 32.5},
    {"index": 1, "start_seconds": 32.5, "end_seconds": 65.0, "duration_seconds": 32.5}
  ],
  "energy_curve": [45.2, 48.1, 52.3, ...],
  "spectrum_profile": {
    "sub_db": 28.5,
    "bass_db": 32.1,
    "low_mid_db": 30.2,
    "mid_db": 25.8,
    "upper_mid_db": 22.4,
    "presence_db": 18.9,
    "brilliance_db": 12.3,
    "air_db": 5.1
  }
}
```

## Frequency Bands

The spectrum profile uses the same bands as ClaudeVST:

| Band | Frequency Range |
|------|-----------------|
| Sub | 20-60 Hz |
| Bass | 60-250 Hz |
| Low Mid | 250-500 Hz |
| Mid | 500-2000 Hz |
| Upper Mid | 2000-4000 Hz |
| Presence | 4000-6000 Hz |
| Brilliance | 6000-12000 Hz |
| Air | 12000-20000 Hz |

## Supported Formats

Any format supported by librosa/soundfile:
- WAV
- MP3
- FLAC
- OGG
- AIFF
