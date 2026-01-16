# Services

Docker containers and MCP servers for ClaudeVST.

| Service | Type | Purpose |
|---------|------|---------|
| genre-segmenter | Docker | Custom beat-synchronous segmentation for techno/psytrance |
| allin1 | Docker | Deep learning semantic segmentation (WASPAA 2023) |
| msaf | Docker | Traditional signal processing fallback |
| document-mcp | MCP Server | Document indexing & search (TEACHER knowledge base) |
| audio-analysis | Docker | Audio analysis utilities |

**Note:** Ableton control is provided by `packages/unified-bridge/` (TypeScript MCP server using AbletonOSC).
