#!/bin/bash
# Teacher Agent Monitor - Starts background monitoring service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/Users/mk/c/ClaudeVST"
STATE_FILE="$HOME/.claude/.teacher-agent-state.json"
PID_FILE="$HOME/.claude/.teacher-agent.pid"

# Parse command
COMMAND="${1:-start}"

case "$COMMAND" in
    start)
        # Check if already running
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "❌ Teacher agent already running (PID: $PID)"
                echo "Use '/teacher stop' to stop it first"
                exit 1
            fi
        fi

        # Create state file
        cat > "$STATE_FILE" <<EOF
{
  "status": "starting",
  "started_at": $(date +%s),
  "last_check": 0,
  "messages_processed": 0,
  "project_root": "$PROJECT_ROOT"
}
EOF

        echo "🎓 Starting Teacher Agent monitoring..."
        echo "   Project: $PROJECT_ROOT"
        echo "   Monitoring: messages/to_claude.json"
        echo "   Writing to: messages/from_teacher.json"
        echo ""
        echo "Teacher will:"
        echo "  • Check for messages every 2 seconds"
        echo "  • Respond automatically when messages arrive"
        echo "  • Use Ableton MCP tools (with permission)"
        echo "  • Keep running until you '/teacher stop'"
        echo ""
        # Start monitoring in background
        nohup bash -c '
            TEACHER_PROMPT="You are the Teacher agent for ClaudeVST.

Read /Users/mk/c/ClaudeVST/agents/teacher_agent.md for your full instructions.

Your continuous monitoring loop:
1. Read /Users/mk/c/ClaudeVST/messages/to_claude.json
2. Check timestamp against last_processed (start with 0)
3. If new message (ignore M: prefix):
   - Process with your music production expertise
   - Reference audio_context if available
   - Ask permission before using Ableton MCP tools
   - Write response to /Users/mk/c/ClaudeVST/messages/from_teacher.json
4. Sleep 2 seconds
5. REPEAT FOREVER

Start monitoring now. Run this loop indefinitely."

            # Infinite monitoring loop
            LAST_TS=0
            while true; do
                # Check for new message
                if [ -f "/Users/mk/c/ClaudeVST/messages/to_claude.json" ]; then
                    TS=$(jq -r ".timestamp" /Users/mk/c/ClaudeVST/messages/to_claude.json 2>/dev/null || echo "0")
                    MSG=$(jq -r ".message" /Users/mk/c/ClaudeVST/messages/to_claude.json 2>/dev/null || echo "")

                    if [ "$TS" -gt "$LAST_TS" ] && [ ! -z "$MSG" ] && [[ ! "$MSG" =~ ^M: ]]; then
                        echo "[$(date +%T)] New message detected: $MSG"

                        # TODO: Invoke Claude Code with Teacher prompt to process this message
                        # For now, just log it
                        LAST_TS=$TS

                        # Update state
                        jq ".last_check = $(date +%s) | .messages_processed += 1" "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
                    fi
                fi

                sleep 2
            done
        ' > "$HOME/.claude/.teacher-agent.log" 2>&1 &

        echo $! > "$PID_FILE"

        # Update state
        jq ".status = \"running\" | .pid = $!" "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

        echo "✅ Teacher agent started successfully (PID: $!)"
        echo "   Logs: ~/.claude/.teacher-agent.log"
        echo "   Use '/teacher status' to check status"
        ;;

    stop)
        if [ ! -f "$PID_FILE" ]; then
            echo "❌ Teacher agent is not running"
            exit 1
        fi

        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            kill "$PID"
            echo "✅ Teacher agent stopped (PID: $PID)"
        else
            echo "⚠️  Teacher agent PID $PID not found (already stopped?)"
        fi

        rm -f "$PID_FILE" "$STATE_FILE"
        ;;

    status)
        if [ ! -f "$STATE_FILE" ]; then
            echo "❌ Teacher agent is not running"
            echo "   Use '/teacher start' to start monitoring"
            exit 0
        fi

        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                STARTED=$(jq -r '.started_at' "$STATE_FILE" 2>/dev/null || echo "unknown")
                PROCESSED=$(jq -r '.messages_processed' "$STATE_FILE" 2>/dev/null || echo "0")
                echo "✅ Teacher agent is RUNNING"
                echo "   PID: $PID"
                echo "   Started: $(date -r "$STARTED" 2>/dev/null || echo "unknown")"
                echo "   Messages processed: $PROCESSED"
                exit 0
            fi
        fi

        echo "⚠️  Teacher agent state file exists but process not running"
        echo "   Use '/teacher start' to restart"
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo "Usage: /teacher [start|stop|status]"
        exit 1
        ;;
esac
