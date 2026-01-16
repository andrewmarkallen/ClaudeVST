#!/usr/bin/env python3
"""
Minimal allin1 wrapper for music structure analysis.
All post-processing (quantization, hierarchy) done in TypeScript.
"""

import sys
import json
import warnings

warnings.filterwarnings("ignore")

import allin1


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze.py <audio_file>"}))
        sys.exit(1)

    audio_path = sys.argv[1]

    try:
        result = allin1.analyze(audio_path)

        output = {
            "bpm": float(result.bpm),
            "beats": [float(b) for b in result.beats],
            "downbeats": [float(d) for d in result.downbeats],
            "segments": [
                {
                    "start": float(s.start),
                    "end": float(s.end),
                    "label": s.label
                }
                for s in result.segments
            ]
        }

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
