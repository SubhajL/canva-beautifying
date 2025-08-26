#!/bin/bash
# Full conversation parser - captures complete messages without truncation

PROJECT_ROOT="/Users/subhajlimanond/dev/canva-beautifying"
CLAUDE_DIR="$HOME/.claude/projects/-Users-subhajlimanond-dev-canva-beautifying"
DOCS_DIR="$PROJECT_ROOT/docs"
STATE_FILE="$PROJECT_ROOT/.claude/.full-parser-state"
POSITION_FILE="$PROJECT_ROOT/.claude/.full-parser-positions"

# Create necessary files
mkdir -p "$(dirname "$STATE_FILE")"
touch "$STATE_FILE" "$POSITION_FILE"

# Function to extract instance from context file path
extract_instance_from_path() {
    local path="$1"
    local filename=$(basename "$path")
    
    # Map your instance files here
    case "$filename" in
        "CLAUDE.md") echo "Main Instance" ;;
        "AI_SERVICE.md") echo "AI Service" ;;
        "ENHANCE_SERVICE.md") echo "Enhancement Service" ;;
        "QUEUE_SERVICE.md") echo "Queue Service" ;;
        "STORAGE_SERVICE.md") echo "Storage Service" ;;
        "AUTH_SERVICE.md") echo "Auth Service" ;;
        "API_SERVICE.md") echo "API Service" ;;
        "WEBSOCKET_SERVICE.md") echo "WebSocket Service" ;;
        *) echo "" ;;
    esac
}

# Function to get target file for instance
get_target_file() {
    local instance="$1"
    case "$instance" in
        "Main Instance") echo "MAIN_INSTANCE.md" ;;
        "AI Service") echo "AI_SERVICE.md" ;;
        "Enhancement Service") echo "ENHANCE_SERVICE.md" ;;
        "Queue Service") echo "QUEUE_SERVICE.md" ;;
        "Storage Service") echo "STORAGE_SERVICE.md" ;;
        "Auth Service") echo "AUTH_SERVICE.md" ;;
        "API Service") echo "API_SERVICE.md" ;;
        "WebSocket Service") echo "WEBSOCKET_SERVICE.md" ;;
        *) echo "UNKNOWN_INSTANCE.md" ;;
    esac
}

# Track last position in file to avoid reprocessing
get_last_position() {
    local file_id="$1"
    grep "^$file_id:" "$POSITION_FILE" 2>/dev/null | cut -d: -f2 || echo "0"
}

update_position() {
    local file_id="$1"
    local position="$2"
    grep -v "^$file_id:" "$POSITION_FILE" > "$POSITION_FILE.tmp" || true
    echo "$file_id:$position" >> "$POSITION_FILE.tmp"
    mv "$POSITION_FILE.tmp" "$POSITION_FILE"
}

# Process JSONL file incrementally
process_jsonl_full() {
    local jsonl_file="$1"
    local file_id=$(basename "$jsonl_file" .jsonl)
    
    [ ! -f "$jsonl_file" ] && return
    
    # Get current line count and last processed position
    local total_lines=$(wc -l < "$jsonl_file")
    local last_position=$(get_last_position "$file_id")
    
    [ "$last_position" -ge "$total_lines" ] && return
    
    echo "Processing: $file_id (lines $((last_position + 1)) to $total_lines)"
    
    # Identify instance from first message
    local instance=""
    if ! grep -q "^$file_id:" "$STATE_FILE"; then
        # New file - identify instance
        local first_message=$(jq -r 'select(.type=="user") | .message.content // .message.content[0].text // ""' "$jsonl_file" 2>/dev/null | head -1)
        
        # Pattern 1: [Instance Name] tag
        if [[ "$first_message" =~ ^\[([^\]]+)\] ]]; then
            instance="${BASH_REMATCH[1]}"
        # Pattern 2: Context file reference
        elif [[ "$first_message" =~ context\ file.*(/[^[:space:]]+\.md) ]]; then
            local context_path="${BASH_REMATCH[1]}"
            instance=$(extract_instance_from_path "$context_path")
        fi
        
        [ -z "$instance" ] && echo "Warning: Could not identify instance" && return
        
        echo "$file_id:$instance" >> "$STATE_FILE"
    else
        instance=$(grep "^$file_id:" "$STATE_FILE" | cut -d: -f2)
    fi
    
    # Get target file and ensure it exists
    local target_file=$(get_target_file "$instance")
    local full_path="$DOCS_DIR/$target_file"
    
    mkdir -p "$DOCS_DIR"
    [ ! -f "$full_path" ] && echo "# $instance Conversations" > "$full_path"
    
    # Process only new lines
    local temp_count="/tmp/parser-count-$$"
    echo "0" > "$temp_count"
    
    tail -n +$((last_position + 1)) "$jsonl_file" | while IFS= read -r line; do
        [ -z "$line" ] && continue
        
        local type=$(echo "$line" | jq -r '.type' 2>/dev/null)
        
        if [ "$type" = "user" ]; then
            local content=$(echo "$line" | jq -r '
                .message.content | 
                if type == "string" then . 
                elif type == "array" then 
                    if .[0].type == "tool_result" then
                        "Tool result: " + .[0].content
                    else
                        .[0].text // ""
                    end
                else "" end
            ' 2>/dev/null)
            
            if [ -n "$content" ]; then
                {
                    echo ""
                    echo "### User"
                    echo "$content"
                    echo ""
                } >> "$full_path"
                echo $(($(cat "$temp_count") + 1)) > "$temp_count"
            fi
        elif [ "$type" = "assistant" ]; then
            local content=$(echo "$line" | jq -r '
                .message.content | 
                if type == "array" then 
                    map(select(.type == "text") | .text) | join("\n\n")
                else . end
            ' 2>/dev/null)
            
            if [ -n "$content" ]; then
                {
                    echo "### Assistant"
                    echo "$content"
                    echo ""
                } >> "$full_path"
                echo $(($(cat "$temp_count") + 1)) > "$temp_count"
            fi
        fi
    done
    
    local messages_added=$(cat "$temp_count")
    rm -f "$temp_count"
    
    echo "✓ Added $messages_added messages to $target_file"
    update_position "$file_id" "$total_lines"
}

# Main processing
if [ -n "$1" ]; then
    process_jsonl_full "$1"
else
    find "$CLAUDE_DIR" -name "*.jsonl" -type f | sort | while read -r jsonl_file; do
        process_jsonl_full "$jsonl_file"
    done
fi