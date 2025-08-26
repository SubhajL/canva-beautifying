#!/bin/bash
# Smart startup for conversation monitoring

PROJECT_ROOT="/Users/subhajlimanond/dev/canva-beautifying"
PARSER_SCRIPT="$PROJECT_ROOT/.claude/full-conversation-parser.sh"
MONITOR_SCRIPT="$PROJECT_ROOT/.claude/conversation-monitor.sh"
LAST_RUN_FILE="$PROJECT_ROOT/.claude/.last-monitor-run"

# Check when last run
if [ -f "$LAST_RUN_FILE" ]; then
    last_run=$(cat "$LAST_RUN_FILE")
    last_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last_run" +%s 2>/dev/null || echo 0)
    current_epoch=$(date +%s)
    hours_elapsed=$(( (current_epoch - last_epoch) / 3600 ))
    
    if [ $hours_elapsed -gt 24 ]; then
        echo "System was down > 24 hours, running full scan..."
        "$PARSER_SCRIPT"
    fi
else
    echo "First run - processing all conversations..."
    "$PARSER_SCRIPT"
fi

# Update timestamp
date "+%Y-%m-%d %H:%M:%S" > "$LAST_RUN_FILE"

# Start monitor
exec "$MONITOR_SCRIPT"