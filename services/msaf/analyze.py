#!/usr/bin/env python3
"""
Minimal MSAF wrapper for music structure analysis.
Outputs raw boundaries and cluster IDs - all post-processing done in TypeScript.
"""

import warnings
warnings.filterwarnings("ignore")

import sys
import json
import msaf
import librosa


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze.py <audio_file>"}))
        sys.exit(1)

    audio_path = sys.argv[1]

    try:
        # Load audio to get tempo and duration
        y, sr = librosa.load(audio_path, sr=22050)
        duration = librosa.get_duration(y=y, sr=sr)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

        # Get beat times for quantization
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        # Estimate downbeats (every 4 beats for 4/4 time)
        downbeats = beat_times[::4].tolist() if len(beat_times) >= 4 else beat_times.tolist()

        # Run MSAF - returns boundaries and cluster IDs
        boundaries, labels = msaf.process(
            audio_path,
            boundaries_id="sf",    # Spectral Flux
            labels_id="fmc2d",     # 2D Fourier Magnitude Coefficients
        )

        # Output raw results - TypeScript handles label mapping and quantization
        output = {
            "bpm": float(tempo),
            "duration": float(duration),
            "beats": [float(b) for b in beat_times],
            "downbeats": [float(d) for d in downbeats],
            "boundaries": [float(b) for b in boundaries],
            "labels": [int(l) for l in labels]  # Raw cluster IDs, not semantic labels
        }

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
