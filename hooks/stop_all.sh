#!/bin/bash
# Stop all ClaudeVST services and agents

set -e

PROJECT_ROOT="/Users/mk/c/ClaudeVST"
SERVICES_DIR="$PROJECT_ROOT/services"

echo "Stopping all ClaudeVST services..."

# Function to stop a service by PID file
stop_service() {
    local service_name=$1
    local pid_file="$SERVICES_DIR/${service_name}.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "  Stopping $service_name (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 1

            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo "  Force stopping $service_name..."
                kill -9 $pid 2>/dev/null || true
            fi
        else
            echo "  $service_name not running (stale PID file)"
        fi
        rm -f "$pid_file"
    else
        echo "  $service_name not running"
    fi
}

# Stop all services
stop_service "teacher"
stop_service "master"
stop_service "ralph"
stop_service "tts_watcher"
stop_service "osc_monitor"

echo ""
echo "All services stopped."
