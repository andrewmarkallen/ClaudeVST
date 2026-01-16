#!/usr/bin/env python3
"""
Teacher Watcher - Monitors for user messages and alerts
Watches messages/to_claude.json for new messages from VST
Beeps and prints alert when user sends a message to Teacher
"""

import json
import time
import subprocess
import sys
from pathlib import Path

# Configuration
MESSAGES_PATH = Path.home() / "c/ClaudeVST/messages/to_claude.json"
ALERT_SOUND = "/System/Library/Sounds/Ping.aiff"

def play_alert():
    """Play system alert sound"""
    try:
        subprocess.run(["afplay", ALERT_SOUND], check=False)
    except Exception:
        print("\a")  # Fallback to terminal bell

def main():
    print("=" * 60)
    print("🎓 TEACHER WATCHER - Monitoring for user messages")
    print("=" * 60)
    print(f"Watching: {MESSAGES_PATH}")
    print("Alerts when user sends message to Teacher")
    print("(Ignores messages starting with 'M:' - those are for Master)")
    print("Press Ctrl+C to stop\n")

    last_timestamp = 0

    while True:
        try:
            if MESSAGES_PATH.exists():
                data = json.loads(MESSAGES_PATH.read_text())
                timestamp = data.get("timestamp", 0)
                message = data.get("message", "")

                # Check for new message
                if timestamp > last_timestamp and message:
                    # Ignore Master-prefixed messages
                    if message.startswith("M:"):
                        print(f"[{time.strftime('%H:%M:%S')}] Master message (ignored)")
                        last_timestamp = timestamp
                        continue

                    # Alert for Teacher message
                    last_timestamp = timestamp
                    print("\n" + "=" * 60)
                    print(f"🔔 NEW MESSAGE FOR TEACHER [{time.strftime('%H:%M:%S')}]")
                    print("=" * 60)
                    print(f"Message: {message}")

                    # Check if audio context included
                    audio_ctx = data.get("audio_context", "")
                    if audio_ctx:
                        print("📊 Audio context: Available")

                    print("=" * 60)
                    print("👉 ACTION: Tell Teacher in Terminal 3 to check for messages!")
                    print("=" * 60 + "\n")

                    # Play alert sound
                    play_alert()

        except json.JSONDecodeError:
            pass  # File being written
        except FileNotFoundError:
            pass  # File doesn't exist yet
        except Exception as e:
            print(f"⚠️  Error: {e}")

        time.sleep(0.3)  # Poll 3x per second

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Teacher Watcher stopped. Goodbye!")
        sys.exit(0)
