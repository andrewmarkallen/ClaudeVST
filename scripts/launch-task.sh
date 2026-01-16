#!/bin/bash
# Task Launcher - Launches configured tasks from .claude/tasks.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASKS_FILE="$PROJECT_ROOT/.claude/tasks.json"
TASK_NAME="${1}"

if [ -z "$TASK_NAME" ]; then
    echo "Usage: $0 <task-name|task-group>"
    echo ""
    echo "Available tasks:"
    jq -r '.tasks | keys[]' "$TASKS_FILE" 2>/dev/null | sed 's/^/  - /'
    echo ""
    echo "Available task groups:"
    jq -r '.task_groups | keys[]' "$TASKS_FILE" 2>/dev/null | sed 's/^/  - /'
    exit 1
fi

# Check if it's a task group
if jq -e ".task_groups.\"$TASK_NAME\"" "$TASKS_FILE" >/dev/null 2>&1; then
    echo "🚀 Launching task group: $TASK_NAME"
    TASKS=$(jq -r ".task_groups.\"$TASK_NAME\".startup_order[]" "$TASKS_FILE")
    for task in $TASKS; do
        echo "   Starting: $task"
        "$0" "$task" &
        sleep 1
    done
    echo "✅ Task group launched"
    exit 0
fi

# Get task config
TASK_CONFIG=$(jq ".tasks.\"$TASK_NAME\"" "$TASKS_FILE" 2>/dev/null)
if [ "$TASK_CONFIG" == "null" ]; then
    echo "❌ Task not found: $TASK_NAME"
    exit 1
fi

TASK_TYPE=$(echo "$TASK_CONFIG" | jq -r '.type')
TASK_ENABLED=$(echo "$TASK_CONFIG" | jq -r '.enabled')
TASK_DESC=$(echo "$TASK_CONFIG" | jq -r '.description')

if [ "$TASK_ENABLED" != "true" ]; then
    echo "⚠️  Task is disabled: $TASK_NAME"
    echo "   Enable in $TASKS_FILE"
    exit 1
fi

echo "🚀 Launching: $TASK_NAME"
echo "   Type: $TASK_TYPE"
echo "   Description: $TASK_DESC"
echo ""

case "$TASK_TYPE" in
    ralph-loop)
        PROMPT=$(echo "$TASK_CONFIG" | jq -r '.prompt')
        MAX_ITER=$(echo "$TASK_CONFIG" | jq -r '.options."max-iterations" // 99999')

        # Save prompt to temp file for ralph-loop
        PROMPT_FILE="/tmp/claude-task-$TASK_NAME.md"
        echo "$PROMPT" > "$PROMPT_FILE"

        echo "   Max iterations: $MAX_ITER"
        echo "   Prompt saved to: $PROMPT_FILE"
        echo ""
        echo "📋 To start Ralph Loop, run in Claude Code terminal:"
        echo "   cat $PROMPT_FILE | claude-code --continue --max-iterations $MAX_ITER"
        echo ""
        echo "   OR use the skill:"
        echo "   /ralph-loop \"\$(cat $PROMPT_FILE)\" --max-iterations $MAX_ITER"
        ;;

    bash-service)
        COMMAND=$(echo "$TASK_CONFIG" | jq -r '.command')
        echo "   Running: $COMMAND"
        echo ""
        nohup bash -c "$COMMAND" > "/tmp/claude-task-$TASK_NAME.log" 2>&1 &
        PID=$!
        echo $PID > "/tmp/claude-task-$TASK_NAME.pid"
        echo "✅ Started (PID: $PID)"
        echo "   Logs: /tmp/claude-task-$TASK_NAME.log"
        ;;

    *)
        echo "❌ Unknown task type: $TASK_TYPE"
        exit 1
        ;;
esac
