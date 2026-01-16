#!/Users/mk/c/ClaudeVST/companions/voice/.venv/bin/python3
"""
Voice Listener - Listens to microphone, transcribes with Whisper, writes to to_claude.json

🎤 VOICE INPUT FOR TEACHER
- Hold Enter to record 5 seconds
- Transcribes with Whisper.cpp
- Writes to messages/to_claude.json
- Teacher Watcher will alert when message arrives

Requirements (installed in .venv):
  sounddevice, numpy

Uses whisper.cpp CLI (main) for transcription.
"""

import json
import subprocess
import tempfile
import time
from pathlib import Path

try:
    import sounddevice as sd
    import numpy as np
except ImportError:
    print("Install dependencies: pip install sounddevice numpy")
    exit(1)

# Configuration
MESSAGES_PATH = Path.home() / "c/ClaudeVST/messages/to_claude.json"
WHISPER_CLI = Path.home() / "c/ClaudeVST/whisper.cpp/build/bin/main"
WHISPER_MODEL = Path.home() / "c/ClaudeVST/whisper.cpp/models/ggml-tiny.bin"

SAMPLE_RATE = 16000  # Whisper expects 16kHz
CHANNELS = 1


def record_audio(duration_seconds=5):
    """Record audio from microphone"""
    print(f"Recording for {duration_seconds} seconds... (speak now)")
    audio = sd.rec(
        int(duration_seconds * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype=np.float32
    )
    sd.wait()
    print("Recording complete")
    return audio


def transcribe(audio):
    """Transcribe audio using whisper.cpp CLI"""
    # Save audio to temp WAV file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        import wave
        with wave.open(f.name, 'wb') as wav:
            wav.setnchannels(CHANNELS)
            wav.setsampwidth(2)  # 16-bit
            wav.setframerate(SAMPLE_RATE)
            # Convert float32 to int16
            audio_int16 = (audio * 32767).astype(np.int16)
            wav.writeframes(audio_int16.tobytes())

        # Run whisper.cpp
        result = subprocess.run(
            [
                str(WHISPER_CLI),
                "-m", str(WHISPER_MODEL),
                "-f", f.name,
                "-l", "en",
                "--no-timestamps",
                "-nt"  # No prints
            ],
            capture_output=True,
            text=True
        )

        # Clean up
        Path(f.name).unlink()

        return result.stdout.strip()


def write_message(text):
    """Write transcribed message to to_claude.json"""
    message = {
        "timestamp": int(time.time() * 1000),
        "message": text,
        "audio_context": "=== AUDIO ANALYSIS ===\n(from standalone voice listener)\n"
    }
    MESSAGES_PATH.write_text(json.dumps(message, indent=2))
    print(f"Message written: {text}")


def main():
    print("Voice Listener started")
    print(f"Writing to: {MESSAGES_PATH}")
    print(f"Whisper model: {WHISPER_MODEL}")
    print("\nPress Enter to record (5 seconds), Ctrl+C to quit\n")

    while True:
        try:
            input("Press Enter to start recording...")
            audio = record_audio(5)
            text = transcribe(audio)
            if text:
                write_message(text)
            else:
                print("No speech detected")
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    main()
