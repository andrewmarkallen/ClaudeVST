#!/usr/bin/env python3
"""Entry point for genre-segmenter Docker container."""

import sys
import json

from segmenter import analyze


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze.py <audio_path> [genre]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    genre = sys.argv[2] if len(sys.argv) > 2 else 'techno'

    try:
        result = analyze(audio_path, genre)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
