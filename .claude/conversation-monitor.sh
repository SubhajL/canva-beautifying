#!/bin/bash
# Real-time conversation monitor using fswatch

PROJECT_ROOT="/Users/subhajlimanond/dev/canva-beautifying"
CLAUDE_DIR="$HOME/.claude/projects/-Users-subhajlimanond-dev-canva-beautifying"
PARSER_SCRIPT="$PROJECT_ROOT/.claude/full-conversation-parser.sh"

# Check dependencies
if ! command -v fswatch &> /dev/null; then
    echo "Error: fswatch not found. Install with: brew install fswatch"
    exit 1
fi

# Make parser executable
chmod +x "$PARSER_SCRIPT"

# Initial scan
echo "Running initial scan..."
"$PARSER_SCRIPT"
echo "Initial scan complete"

# Monitor for changes
echo "Monitoring for conversation updates..."
echo "Press Ctrl+C to stop"

# Use fswatch to monitor JSONL files
# -0: Use null separator
# -r: Recursive
# -e: Exclude pattern
# -i: Include pattern
fswatch -0 -r -e ".*" -i "\.jsonl$" "$CLAUDE_DIR" | while IFS= read -d "" event; do
    echo -e "\nChange detected: $(basename "$event")"
    
    # Small delay to ensure file write is complete
    sleep 0.5
    
    # Process just the changed file
    "$PARSER_SCRIPT" "$event"
    
    echo "Update complete"
done