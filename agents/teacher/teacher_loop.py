#!/usr/bin/env python3
"""
Autonomous Teacher Loop - Monitors messages and responds using Claude API or local LLM.

This script runs independently and polls for messages every 5 seconds.
By default uses rule-based responses (no API cost), but can use Claude API
with the --use-api flag.

Usage:
    python3 companions/teacher_loop.py              # Rule-based (free)
    python3 companions/teacher_loop.py --use-api   # Claude API (requires ANTHROPIC_API_KEY)

Environment Variables:
    ANTHROPIC_API_KEY - Required for --use-api mode
"""

import json
import time
import os
import argparse
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
MESSAGES_DIR = PROJECT_ROOT / "messages"
TO_CLAUDE = MESSAGES_DIR / "to_claude.json"
FROM_TEACHER = MESSAGES_DIR / "from_teacher.json"
AUDIO_ANALYSIS = MESSAGES_DIR / "audio_analysis.json"
LAST_PROCESSED = PROJECT_ROOT / ".ralph-last-processed"
STUDENT_PROGRESS = PROJECT_ROOT / "data" / "teacher-state" / "student_progress.json"

# System prompt for Claude API mode - based on teacher_agent.md
TEACHER_SYSTEM_PROMPT = """You are an expert music production teacher specializing in:
- Hypnotic Techno production techniques
- BCCO Records aesthetic and sound design
- Music theory applied to electronic music
- Sound design (synthesis, sampling, processing)
- Mixing and mastering for club systems
- Workflow optimization in Ableton Live

Teaching Philosophy:
- Hands-on, practical guidance
- Theory when needed, practice always
- Progressive skill building
- Encourage experimentation

Response Style:
- Be CONCISE - responses will be spoken via TTS, keep under 2-3 sentences when possible
- Be SPECIFIC - use actual dB values, Hz frequencies, parameter names
- Be ACTIONABLE - give clear next steps
- Be ENCOURAGING - positive reinforcement
- Be TECHNICAL but accessible - explain jargon when needed

BCCO Records Style Characteristics (reference these):
- Hypnotic, repetitive patterns with subtle variations
- Deep, rolling basslines (often FM or wavetable)
- Minimal but effective percussion (tight, punchy)
- Emphasis on groove and space over melody
- Dark, atmospheric pads with long reverb tails
- Precise, surgical EQ for clarity
- Controlled dynamics with sidechain compression
- Long, gradual builds (32-64 bars)
- Subtle modulation and filter sweeps

Audio Analysis Interpretation:
- RMS -18 to -12dB: Good mixing level
- Peaks below -1dB: Healthy headroom
- Crest factor 6-10dB: Controlled dynamics for techno
- Sub (20-60Hz) 30-35dB: Strong for kick
- Bass (60-250Hz) 25-30dB: Present but controlled

When given audio context, ALWAYS reference the actual values in your response.
"""

def get_last_processed():
    """Get timestamp of last processed message."""
    try:
        return int(LAST_PROCESSED.read_text().strip())
    except:
        return 0

def set_last_processed(timestamp):
    """Update last processed timestamp."""
    LAST_PROCESSED.write_text(str(timestamp))

def read_message():
    """Read the incoming message."""
    try:
        data = json.loads(TO_CLAUDE.read_text())
        return data
    except:
        return None

def read_audio():
    """Read current audio analysis."""
    try:
        return json.loads(AUDIO_ANALYSIS.read_text())
    except:
        return None

def write_response(response_text):
    """Write response to from_teacher.json."""
    response = {
        "timestamp": int(time.time() * 1000),
        "response": response_text
    }
    FROM_TEACHER.write_text(json.dumps(response, indent=2))

def load_student_progress():
    """Load student progress for context."""
    try:
        return json.loads(STUDENT_PROGRESS.read_text())
    except:
        return {}

def format_audio_context(audio):
    """Format audio data as context string for Claude."""
    if not audio:
        return "No audio signal detected."

    lines = ["=== CURRENT AUDIO ANALYSIS ==="]

    levels = audio.get("levels", {})
    if levels:
        lines.append(f"RMS: L={levels.get('rms_left_db', -100):.1f}dB R={levels.get('rms_right_db', -100):.1f}dB")
        lines.append(f"Peak: L={levels.get('peak_left_db', -100):.1f}dB R={levels.get('peak_right_db', -100):.1f}dB")
        lines.append(f"Crest Factor: {levels.get('crest_factor_db', 0):.1f}dB")

    spectrum = audio.get("spectrum", {})
    if spectrum:
        lines.append("Spectrum:")
        lines.append(f"  Sub (20-60Hz): {spectrum.get('sub_db', -100):.1f}dB")
        lines.append(f"  Bass (60-250Hz): {spectrum.get('bass_db', -100):.1f}dB")
        lines.append(f"  Low-Mid (250-500Hz): {spectrum.get('low_mid_db', -100):.1f}dB")
        lines.append(f"  Mid (500-2kHz): {spectrum.get('mid_db', -100):.1f}dB")
        lines.append(f"  Upper-Mid (2-4kHz): {spectrum.get('upper_mid_db', -100):.1f}dB")
        lines.append(f"  Presence (4-6kHz): {spectrum.get('presence_db', -100):.1f}dB")
        lines.append(f"  Brilliance (6-12kHz): {spectrum.get('brilliance_db', -100):.1f}dB")
        lines.append(f"  Air (12-20kHz): {spectrum.get('air_db', -100):.1f}dB")

    ableton = audio.get("ableton", {})
    if ableton:
        tempo = ableton.get("tempo", 0)
        if tempo > 0:
            lines.append(f"Tempo: {tempo} BPM")

    return "\n".join(lines)

def generate_api_response(message, audio, client):
    """
    Generate a response using Claude API.

    Args:
        message: The incoming message dict
        audio: Audio analysis data dict
        client: Anthropic client instance

    Returns:
        str: Claude's response
    """
    user_message = message.get("message", "")
    audio_context = format_audio_context(audio)

    # Load student progress for context
    progress = load_student_progress()
    progress_context = ""
    if progress:
        recent_topics = progress.get("recent_topics", [])
        if recent_topics:
            progress_context = f"\n\nRecent learning topics: {', '.join(recent_topics[:5])}"

    # Build the user message with context
    full_message = f"{audio_context}\n\n{user_message}{progress_context}"

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=TEACHER_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": full_message}
            ]
        )
        return response.content[0].text
    except Exception as e:
        return f"API Error: {e}. Falling back to rule-based response."

def generate_rule_based_response(message, audio):
    """
    Generate a rule-based Teacher response (no API cost).

    This is the default mode - simple keyword matching with
    pre-written responses for common music production questions.
    """
    msg = message.get("message", "").lower()

    # Get audio context
    audio_context = ""
    if audio:
        levels = audio.get("levels", {})
        rms_l = levels.get("rms_left_db", -100)
        rms_r = levels.get("rms_right_db", -100)
        tempo = audio.get("ableton", {}).get("tempo", 0)

        if rms_l > -60:
            audio_context = f"Audio at {rms_l:.1f}dB RMS. "
        if tempo > 0:
            audio_context += f"Tempo: {tempo} BPM. "

    # Simple responses based on keywords
    if "bpm" in msg or "tempo" in msg:
        return f"{audio_context}For hypnotic techno, 126-130 BPM is the sweet spot. BCCO style tends toward 126-128 for that deep, rolling groove."

    if "kick" in msg:
        return f"{audio_context}For a punchy kick: boost 60-80Hz for weight, add click at 2-4kHz. Compress with fast attack, medium release. Layer a sub sine underneath for low-end power."

    if "bass" in msg:
        return f"{audio_context}Hypnotic basslines often use FM synthesis - try Operator with a simple ratio like 1:2. Keep it monophonic, use glide, and sidechain to the kick for that pumping feel."

    if "mix" in msg or "sound" in msg:
        return f"{audio_context}Your mix sounds like it needs more energy in the low end. Try boosting sub frequencies (40-60Hz) and ensure your kick and bass aren't fighting - use sidechain compression."

    if "sidechain" in msg:
        return f"{audio_context}Sidechain compression: Put a compressor on your bass, set the sidechain input to your kick. Use 4:1 ratio, fast attack (1-5ms), medium release (50-150ms). Adjust threshold until you hear the pump."

    if "test" in msg:
        return f"{audio_context}Teacher is online and monitoring! Send me questions about hypnotic techno production, mixing, sound design, or music theory."

    # Default response
    return f"{audio_context}I'm here to help with hypnotic techno production! Ask me about kicks, basslines, mixing, sidechain compression, or any production technique."

def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Autonomous Teacher Loop - Music Production Tutor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 companions/teacher_loop.py              # Rule-based (free)
    python3 companions/teacher_loop.py --use-api   # Claude API mode

Environment Variables:
    ANTHROPIC_API_KEY - Required for --use-api mode
        """
    )
    parser.add_argument(
        "--use-api",
        action="store_true",
        help="Use Claude API for responses (requires ANTHROPIC_API_KEY env var)"
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=5.0,
        help="Polling interval in seconds (default: 5.0)"
    )
    return parser.parse_args()

def main():
    args = parse_args()

    # Initialize API client if requested
    client = None
    use_api = args.use_api

    if use_api:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("ERROR: --use-api requires ANTHROPIC_API_KEY environment variable")
            print("Set it with: export ANTHROPIC_API_KEY='your-key-here'")
            return 1

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            print("Claude API client initialized successfully")
        except ImportError:
            print("ERROR: anthropic package not installed")
            print("Install with: pip install anthropic")
            return 1
        except Exception as e:
            print(f"ERROR: Failed to initialize API client: {e}")
            return 1

    print("=" * 50)
    print("Teacher Loop - Autonomous Music Production Tutor")
    print("=" * 50)
    mode_str = "Claude API" if use_api else "Rule-based (free)"
    print(f"Mode: {mode_str}")
    print(f"Monitoring: {TO_CLAUDE}")
    print(f"Responding to: {FROM_TEACHER}")
    print(f"Poll interval: {args.poll_interval}s")
    print("Press Ctrl+C to stop")
    print("=" * 50)

    while True:
        try:
            last_ts = get_last_processed()
            message = read_message()

            if message:
                msg_ts = message.get("timestamp", 0)
                msg_text = message.get("message", "")

                # Skip M: messages (for Master)
                if msg_text.startswith("M:"):
                    print(f"[SKIP] Master message: {msg_text[:30]}...")
                    set_last_processed(msg_ts)

                # Process new messages
                elif msg_ts > last_ts:
                    print(f"\n[NEW] Message: {msg_text[:50]}...")

                    audio = read_audio()

                    # Generate response based on mode
                    if use_api and client:
                        print("  Calling Claude API...")
                        response = generate_api_response(message, audio, client)
                    else:
                        response = generate_rule_based_response(message, audio)

                    write_response(response)
                    set_last_processed(msg_ts)

                    print(f"[OK] Responded: {response[:60]}...")
                    print(f"     (Full response written to from_teacher.json)")

                else:
                    now = datetime.now().strftime("%H:%M:%S")
                    print(f"[{now}] Waiting... (last: {last_ts})", end="\r")

            time.sleep(args.poll_interval)

        except KeyboardInterrupt:
            print("\n\nTeacher Loop stopped.")
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(args.poll_interval)

    return 0

if __name__ == "__main__":
    exit(main())
