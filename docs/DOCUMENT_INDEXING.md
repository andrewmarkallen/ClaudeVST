# Document Indexing with document-mcp

**Purpose:** Enable semantic search across all ClaudeVST documentation for agents and developers.

**MCP Server:** github.com/yairwein/document-mcp

---

## Why Document Indexing?

ClaudeVST has **100KB+ of documentation** and growing:

```
agents/ - 50KB of agent instructions
docs/ - 50KB of technical documentation
development/ - Growing backlog and interfaces
External - JUCE docs, MCP Extended docs, Whisper docs
```

**Problem:** Agents and developers need to find relevant docs quickly:
- "How do I integrate with Ralph-MCP's API?"
- "What's the audio analysis message format?"
- "How do I use batch_set_device_parameters in MCP Extended?"
- "What are the threading requirements for VST audio thread?"

**Solution:** Semantic vector search powered by local LLMs (Ollama).

---

## Features

### Real-Time Monitoring
- Auto-detects new/modified files
- Incremental indexing (only changed files reprocess)
- No manual reindexing needed

### Local-First Processing
- Uses Ollama (local LLM, no API costs)
- All docs stay on your machine (privacy)
- sentence-transformers for embeddings
- LanceDB for vector storage

### Multi-Format Support
- Markdown (.md) - all our docs!
- PDF - external documentation
- Text - logs, configs
- Word docs - if needed

### MCP Tool Exposure
Agents can use:
- `search_documents(query)` - Natural language search
- `get_catalog()` - List all indexed documents
- `reindex_document(path)` - Force update

---

## Installation

### 1. Clone Repository
```bash
cd ~/c
git clone https://github.com/yairwein/document-mcp.git
cd document-mcp
pip install -e .
```

### 2. Install Ollama
```bash
# macOS
brew install ollama

# Start Ollama service
ollama serve

# Pull embedding model
ollama pull nomic-embed-text
```

### 3. Configure Directories
Edit `document-mcp/config.yaml`:
```yaml
directories:
  - /Users/mk/c/ClaudeVST/agents
  - /Users/mk/c/ClaudeVST/docs
  - /Users/mk/c/ClaudeVST/development
  - /Users/mk/c/ableton-mcp-extended/README.md
  - /Users/mk/c/ableton-mcp-extended/INSTALLATION.md

file_types:
  - .md
  - .txt
  - .pdf

ollama_model: nomic-embed-text
chunk_size: 1000
chunk_overlap: 200
```

### 4. Add to Claude Config
Edit `~/.config/claude/config.json`:
```json
{
  "mcpServers": {
    "document-indexer": {
      "command": "python",
      "args": ["/Users/mk/c/document-mcp/server.py"]
    },
    "AbletonMCP": {
      "command": "python",
      "args": ["/Users/mk/c/ableton-mcp-extended/MCP_Server/server.py"]
    }
  }
}
```

### 5. Initial Index
```bash
cd document-mcp
python server.py --reindex-all
```

---

## Usage Examples

### For Agents (via MCP)
```python
# Ralph-MCP needs to know Teacher API format
result = await mcp.search_documents(
    "How do I expose methods to Teacher agent?"
)
# Returns: development/interfaces.md section on Teacher API

# Teacher needs audio analysis format
result = await mcp.search_documents(
    "What are the frequency bands in audio_analysis.json?"
)
# Returns: docs/MESSAGES.md spectrum section

# Ralph-VST needs threading info
result = await mcp.search_documents(
    "What are VST audio thread safety requirements?"
)
# Returns: docs/VST.md threading model section
```

### For Developers (via Claude Desktop)
When chatting with Claude:
```
You: "How do I integrate with Ralph-MCP's unified server?"
Claude: *uses document indexer*
        "According to development/interfaces.md, Ralph-MCP exposes..."
```

---

## What Gets Indexed

### Agent Instructions
- `agents/master_agent.md` - Coordination & Ralph management
- `agents/teacher_agent.md` - Teaching methodology & hypnotic techno knowledge
- `agents/ralph_vst.md` - C++/JUCE development
- `agents/ralph_mcp.md` - MCP Extended integration
- `agents/ralph_whisper.md` - Voice recognition
- `agents/ralph_tts.md` - Text-to-speech

### Technical Documentation
- `docs/SYSTEM.md` - Architecture overview
- `docs/MESSAGES.md` - Message format specs
- `docs/VST.md` - Build system & threading
- `docs/ABLETONOSC.md` - OSC commands (if used)
- `docs/WHISPER.md` - Voice setup
- `docs/TTS.md` - Voice output

### Development
- `development/backlog.md` - Task list
- `development/interfaces.md` - Subsystem APIs
- `development/reports/*.md` - Ralph cycle reports

### External Documentation
- `ableton-mcp-extended/README.md` - MCP Extended features
- `ableton-mcp-extended/INSTALLATION.md` - Setup guide
- JUCE docs (if added)
- Whisper.cpp docs (if added)

---

## Maintenance

### Auto-Update
Document-mcp monitors directories and auto-reindexes on changes. No manual intervention needed.

### Manual Reindex
If needed:
```bash
# Reindex everything
python server.py --reindex-all

# Reindex specific file
python server.py --reindex /Users/mk/c/ClaudeVST/agents/ralph_mcp.md
```

### Check Index Status
```python
# Via MCP
catalog = await mcp.get_catalog()
print(f"Indexed: {len(catalog)} documents")
```

---

## Performance

### Indexing Speed
- Initial index: ~2-3 minutes for 100KB docs
- Incremental updates: < 1 second per changed file
- Real-time monitoring: < 100ms to detect changes

### Search Speed
- Vector search: ~50-100ms typical
- Returns top N most relevant chunks
- Ranked by semantic similarity

---

## Privacy & Security

### All Local
- Ollama runs locally (no external API calls)
- Embeddings generated on your machine
- LanceDB stored locally
- Docs never leave your computer

### No Internet Required
Once Ollama model downloaded, works offline.

---

## Troubleshooting

### Ollama Not Found
```bash
# Check if running
ps aux | grep ollama

# Start if needed
ollama serve
```

### Model Missing
```bash
# Pull embedding model
ollama pull nomic-embed-text
```

### Index Not Updating
```bash
# Force reindex
python server.py --reindex-all
```

### Search Returns Nothing
- Check config.yaml has correct paths
- Verify files have .md extension
- Try manual reindex

---

## Future Enhancements

- Index code comments from src/*.cpp files
- Index JUCE framework documentation
- Index example projects
- Multi-language support (Japanese for user?)

---

*Last updated: 2026-01-16*
