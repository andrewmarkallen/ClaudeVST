#!/bin/bash
# Master control hook - User can call this to execute system-wide commands

set -e

PROJECT_ROOT="/Users/mk/c/ClaudeVST"

# Usage
if [ $# -eq 0 ]; then
    echo "Usage: $0 <command>"
    echo ""
    echo "Available commands:"
    echo "  stop       - Stop all services"
    echo "  start      - Start all services"
    echo "  restart    - Restart all services"
    echo "  status     - Show service status"
    echo "  build      - Build and deploy VST"
    echo ""
    exit 1
fi

COMMAND=$1

case $COMMAND in
    stop)
        "$PROJECT_ROOT/hooks/stop_all.sh"
        ;;
    start)
        "$PROJECT_ROOT/hooks/start_all.sh"
        ;;
    restart)
        "$PROJECT_ROOT/hooks/restart_all.sh"
        ;;
    status)
        echo "Service Status:"
        echo ""
        for pid_file in "$PROJECT_ROOT/services"/*.pid; do
            if [ -f "$pid_file" ]; then
                service_name=$(basename "$pid_file" .pid)
                pid=$(cat "$pid_file")
                if ps -p $pid > /dev/null 2>&1; then
                    echo "  ✓ $service_name running (PID: $pid)"
                else
                    echo "  ✗ $service_name not running (stale PID)"
                fi
            fi
        done
        echo ""
        ;;
    build)
        "$PROJECT_ROOT/scripts/build_and_deploy.sh"
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Run without arguments for usage."
        exit 1
        ;;
esac
