#!/bin/bash
# Restart all ClaudeVST services and agents

set -e

PROJECT_ROOT="/Users/mk/c/ClaudeVST"

echo "Restarting all ClaudeVST services..."
echo ""

# Stop all services
"$PROJECT_ROOT/hooks/stop_all.sh"

echo ""
echo "Waiting 2 seconds..."
sleep 2
echo ""

# Start all services
"$PROJECT_ROOT/hooks/start_all.sh"
