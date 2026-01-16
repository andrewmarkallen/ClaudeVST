#!/usr/bin/env python3
"""
TTS Watcher - Watches for Claude responses and speaks them
Uses macOS 'say' command with high-quality voices

Run with: python3 tts_watcher.py
"""

import json
import subprocess
import time
import sys
from pathlib import Path

# Configuration
MESSAGES_PATH = Path.home() / "c/ClaudeVST/messages/from_claude.json"

# Best macOS voices (in preference order)
VOICES = [
    "Daniel (Enhanced)",  # Good UK English - user's preference!
    "Samantha",           # Good US English
    "Zoe (Premium)",      # Premium if available
    "Alex",               # Default high-quality
]

def get_best_voice():
    """Find the best available voice"""
    result = subprocess.run(["say", "-v", "?"], capture_output=True, text=True)
    available = result.stdout

    for voice in VOICES:
        if voice in available:
            return voice
    return "Samantha"  # Fallback

def speak(text, voice):
    """Speak text using macOS say command"""
    # Use slightly faster rate for responsiveness
    subprocess.run(["say", "-v", voice, "-r", "180", text])

def main():
    voice = get_best_voice()
    print(f"TTS Watcher started")
    print(f"Voice: {voice}")
    print(f"Watching: {MESSAGES_PATH}")
    print("Press Ctrl+C to stop\n")

    # Startup announcement
    speak("TTS Watcher ready", voice)

    last_timestamp = 0

    while True:
        try:
            if MESSAGES_PATH.exists():
                data = json.loads(MESSAGES_PATH.read_text())
                timestamp = data.get("timestamp", 0)
                response = data.get("response", "")

                if timestamp > last_timestamp and response:
                    last_timestamp = timestamp
                    print(f"\n[{time.strftime('%H:%M:%S')}] Speaking: {response[:60]}...")
                    speak(response, voice)
                    print("Done")

        except json.JSONDecodeError:
            pass  # File being written
        except Exception as e:
            print(f"Error: {e}")

        time.sleep(0.3)  # Check 3x per second

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nGoodbye!")
        sys.exit(0)
