# Claude Conversation Logging System

This system automatically captures and organizes Claude conversations by monitoring JSONL files with fswatch.

## Setup

1. **Install dependencies:**
   ```bash
   brew install fswatch jq
   ```

2. **Start monitoring:**
   ```bash
   # Basic start
   ./.claude/conversation-monitor.sh
   
   # With restart handling
   ./.claude/start-monitor.sh
   ```

## How It Works

1. **Instance Detection**: The system identifies conversations based on:
   - `[Instance Name]` tags at the start of conversations
   - Context file references (e.g., "Please read context file: /path/to/SERVICE.md")

2. **File Mapping**: Conversations are saved to specific markdown files based on the detected instance:
   - Main Instance → `docs/MAIN_INSTANCE.md`
   - AI Service → `docs/AI_SERVICE.md`
   - Enhancement Service → `docs/ENHANCE_SERVICE.md`
   - Queue Service → `docs/QUEUE_SERVICE.md`
   - Storage Service → `docs/STORAGE_SERVICE.md`
   - Auth Service → `docs/AUTH_SERVICE.md`
   - API Service → `docs/API_SERVICE.md`
   - WebSocket Service → `docs/WEBSOCKET_SERVICE.md`

3. **Real-time Processing**: fswatch monitors for changes to JSONL files and processes them incrementally, only parsing new content.

## Usage

Start conversations with proper identification:

```
[AI Service] Working on the AI model abstraction layer...
```

Or reference a context file:
```
Please read the context file: /path/to/AI_SERVICE.md
```

The system will automatically:
- Detect the conversation instance
- Append the conversation to the appropriate markdown file
- Track processing state to avoid duplicates

## Features

- **CPU Efficient**: Uses fswatch instead of polling
- **Incremental Processing**: Only processes new content
- **Full Message Capture**: Extracts complete messages without truncation
- **Automatic Organization**: Routes conversations to appropriate files
- **Restart Handling**: Intelligently handles system restarts

## File Structure

```
.claude/
├── full-conversation-parser.sh    # Core parsing logic
├── conversation-monitor.sh        # FSWatch monitor
├── start-monitor.sh              # Smart startup script
├── .full-parser-state           # Instance mappings
├── .full-parser-positions       # File position tracking
└── .last-monitor-run           # Last run timestamp

docs/
├── MAIN_INSTANCE.md            # Main instance conversations
├── AI_SERVICE.md              # AI service conversations
├── ENHANCE_SERVICE.md         # Enhancement service conversations
└── ...                        # Other service conversations
```