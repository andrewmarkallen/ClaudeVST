#!/usr/bin/env python3
"""
Reference Track Analyzer for ClaudeVST Sound Design Coaching

Analyzes audio files to extract:
- BPM
- Section boundaries
- Energy curve
- Spectrum profile (matching VST frequency bands)

Output is JSON suitable for coaching comparisons.
"""

import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np


# VST frequency band definitions (Hz)
FREQUENCY_BANDS = {
    "sub": (20, 60),
    "bass": (60, 250),
    "low_mid": (250, 500),
    "mid": (500, 2000),
    "upper_mid": (2000, 4000),
    "presence": (4000, 6000),
    "brilliance": (6000, 12000),
    "air": (12000, 20000),
}


def detect_bpm(y: np.ndarray, sr: int) -> float:
    """Detect BPM using librosa beat tracking."""
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    # Handle both scalar and array return types
    if isinstance(tempo, np.ndarray):
        return float(tempo[0])
    return float(tempo)


def detect_sections(y: np.ndarray, sr: int, bpm: float) -> list[dict]:
    """
    Detect sections using spectral clustering.
    Returns list of section boundaries with timestamps, bar positions, energy, and labels.
    """
    # Compute spectral features for segmentation
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

    # Use agglomerative clustering to find section boundaries
    # k determines number of sections (auto-detect based on duration)
    duration = len(y) / sr
    n_sections = max(2, min(8, int(duration / 30)))  # Roughly one section per 30s

    # Calculate timing from BPM
    beats_per_bar = 4
    seconds_per_beat = 60.0 / bpm
    seconds_per_bar = seconds_per_beat * beats_per_bar

    # Compute RMS for energy calculation
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)

    try:
        boundaries = librosa.segment.agglomerative(mfcc, k=n_sections)

        # Convert frame boundaries to time
        boundary_times = librosa.frames_to_time(boundaries, sr=sr)

        sections = []
        section_energies = []

        # First pass: calculate energies for all sections
        for i, start_time in enumerate(boundary_times):
            end_time = boundary_times[i + 1] if i + 1 < len(boundary_times) else duration

            # Calculate energy for this section
            mask = (rms_times >= start_time) & (rms_times < end_time)
            if np.any(mask):
                section_energy = float(np.mean(rms[mask]))
            else:
                section_energy = 0.0
            section_energies.append(section_energy)

        # Normalize energies to 0-100
        max_energy = max(section_energies) if section_energies else 1.0
        if max_energy > 0:
            normalized_energies = [(e / max_energy) * 100 for e in section_energies]
        else:
            normalized_energies = [0.0] * len(section_energies)

        # Second pass: build section dicts with labels
        for i, start_time in enumerate(boundary_times):
            end_time = boundary_times[i + 1] if i + 1 < len(boundary_times) else duration

            # Calculate bar positions
            start_beat = start_time / seconds_per_beat
            end_beat = end_time / seconds_per_beat
            start_bar = int(start_beat // beats_per_bar)
            bars = max(1, int((end_beat - start_beat) // beats_per_bar))

            energy_normalized = normalized_energies[i]

            # Calculate relative energy for labeling
            relative_energy = energy_normalized / 100.0

            # Assign label based on relative energy
            if relative_energy > 0.8:
                label = "Drop/Peak"
            elif relative_energy > 0.5:
                label = "Build/Plateau"
            elif relative_energy > 0.3:
                label = "Breakdown"
            else:
                label = "Intro/Outro"

            sections.append({
                "index": i,
                "start_time": round(float(start_time), 2),
                "end_time": round(float(end_time), 2),
                "start_bar": start_bar,
                "bars": bars,
                "energy": round(energy_normalized, 1),
                "label": label,
            })

        return sections
    except Exception as e:
        print(f"Warning: Section detection failed: {e}", file=sys.stderr)
        return [{
            "index": 0,
            "start_time": 0,
            "end_time": round(duration, 2),
            "start_bar": 0,
            "bars": max(1, int(duration / seconds_per_bar)),
            "energy": 50.0,
            "label": "Unknown",
        }]


def extract_energy_curve(y: np.ndarray, sr: int, hop_length: int = 512) -> list[dict]:
    """
    Extract energy curve as RMS normalized to 0-100.
    Returns approximately 1 point per second as list of {time, energy} dicts.
    """
    # Calculate how many samples per second
    samples_per_second = sr

    # Adjust hop_length to get approximately 1 point per second
    # We want frames_per_second = sr / hop_length ≈ 1
    # So hop_length ≈ sr for 1 point per second
    effective_hop = samples_per_second  # One frame per second

    rms = librosa.feature.rms(y=y, hop_length=effective_hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=effective_hop)

    # Normalize to 0-100
    rms_max = np.max(rms)
    if rms_max > 0:
        rms_normalized = (rms / rms_max) * 100
    else:
        rms_normalized = rms

    return [
        {"time": round(float(t), 1), "energy": round(float(e), 1)}
        for t, e in zip(times, rms_normalized)
    ]


def analyze_spectrum_profile(y: np.ndarray, sr: int) -> dict[str, float]:
    """
    Analyze average spectrum matching VST frequency bands.
    Returns dB values for each band.
    """
    # Compute power spectrum
    n_fft = 4096
    S = np.abs(librosa.stft(y, n_fft=n_fft)) ** 2

    # Get frequency bins
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    # Average power across time
    avg_power = np.mean(S, axis=1)

    # Calculate energy in each band
    spectrum_profile = {}
    for band_name, (low_freq, high_freq) in FREQUENCY_BANDS.items():
        # Find bins in this frequency range
        mask = (freqs >= low_freq) & (freqs < high_freq)
        if np.any(mask):
            band_power = np.mean(avg_power[mask])
            # Convert to dB (with floor to avoid log(0))
            band_db = 10 * np.log10(max(band_power, 1e-10))
            spectrum_profile[band_name + "_db"] = round(float(band_db), 1)
        else:
            spectrum_profile[band_name + "_db"] = -60.0

    return spectrum_profile


def analyze_reference(filepath: str) -> dict:
    """
    Perform full analysis on an audio file.
    Returns dictionary with all analysis results.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {filepath}")

    print(f"Loading: {path.name}", file=sys.stderr)
    y, sr = librosa.load(filepath, sr=None, mono=True)
    duration = len(y) / sr

    print(f"Duration: {duration:.1f}s, Sample rate: {sr}Hz", file=sys.stderr)

    print("Analyzing BPM...", file=sys.stderr)
    bpm = detect_bpm(y, sr)

    print("Detecting sections...", file=sys.stderr)
    sections = detect_sections(y, sr, bpm)

    print("Extracting energy curve...", file=sys.stderr)
    energy_curve = extract_energy_curve(y, sr)

    print("Analyzing spectrum profile...", file=sys.stderr)
    spectrum_profile = analyze_spectrum_profile(y, sr)

    return {
        "file": str(path.absolute()),
        "duration_seconds": round(duration, 2),
        "bpm": round(bpm, 1),
        "sections": sections,
        "energy_curve": energy_curve,
        "spectrum_profile": spectrum_profile,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Analyze reference tracks for ClaudeVST coaching"
    )
    parser.add_argument("file", help="Audio file to analyze (WAV, MP3, etc.)")
    parser.add_argument(
        "-o", "--output",
        help="Output JSON file (default: print to stdout)"
    )

    args = parser.parse_args()

    try:
        result = analyze_reference(args.file)

        json_output = json.dumps(result, indent=2)

        if args.output:
            with open(args.output, "w") as f:
                f.write(json_output)
            print(f"Analysis saved to: {args.output}", file=sys.stderr)
        else:
            print(json_output)

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Analysis failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
