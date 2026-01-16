#!/bin/bash
# Start all ClaudeVST services and agents with auto-restart

set -e

PROJECT_ROOT="/Users/mk/c/ClaudeVST"
SERVICES_DIR="$PROJECT_ROOT/services"
LOGS_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOGS_DIR"

echo "Starting all ClaudeVST services..."

# Function to start a service with auto-restart
start_service() {
    local service_name=$1
    local command=$2
    local pid_file="$SERVICES_DIR/${service_name}.pid"
    local log_file="$LOGS_DIR/${service_name}.log"

    # Check if already running
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "  $service_name already running (PID: $pid)"
            return
        fi
    fi

    echo "  Starting $service_name..."

    # Start service with auto-restart wrapper
    (
        while true; do
            echo "[$(date)] Starting $service_name" >> "$log_file"
            $command >> "$log_file" 2>&1 &
            local pid=$!
            echo $pid > "$pid_file"

            wait $pid
            local exit_code=$?

            echo "[$(date)] $service_name exited with code $exit_code" >> "$log_file"

            # If PID file was removed, service was stopped intentionally
            if [ ! -f "$pid_file" ]; then
                echo "[$(date)] $service_name stopped intentionally" >> "$log_file"
                break
            fi

            echo "[$(date)] $service_name crashed, restarting in 5 seconds..." >> "$log_file"
            sleep 5
        done
    ) &

    # Give it a moment to start
    sleep 1

    if [ -f "$pid_file" ]; then
        echo "  $service_name started (PID: $(cat $pid_file))"
    else
        echo "  Failed to start $service_name"
    fi
}

# Start TTS watcher
start_service "tts_watcher" "python3 $PROJECT_ROOT/companions/tts/tts_watcher.py"

# Note: Teacher and Master agents are started via Claude Code sessions
# This script only starts the support services

echo ""
echo "Support services started."
echo ""
echo "To start Teacher agent:"
echo "  Open Claude Code terminal"
echo "  Run: claude --agent agents/teacher_agent.md"
echo ""
echo "To start Master agent:"
echo "  Already running in this terminal"
echo ""
echo "To start Ralph agent:"
echo "  Open Claude Code terminal"
echo "  Run: /ralph-loop agents/ralph_agent.md --cycles 20"
