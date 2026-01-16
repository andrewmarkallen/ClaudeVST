#!/usr/bin/env node
/**
 * Unified Ableton Bridge
 *
 * Modes:
 * - mcp: Run as MCP server (stdio) for Claude Code
 * - rest: Run as REST API server for C++ VST adapter
 * - both: Run both simultaneously
 */

import { AbletonMCPServer } from './mcp-server.js';
import { RestAPI } from './rest-api.js';
import { AbletonClient } from './ableton-client.js';
import { DeltaCache } from './delta-cache.js';

const MODE = process.env.MODE || 'mcp';
const REST_PORT = parseInt(process.env.REST_PORT || '8080', 10);

async function main() {
  const ableton = new AbletonClient();
  const cache = new DeltaCache();

  // Try to connect to Ableton on startup
  try {
    await ableton.connect();
    console.error('[UnifiedBridge] Connected to Ableton on startup');
  } catch (error) {
    console.error('[UnifiedBridge] Could not connect to Ableton on startup:', error);
    console.error('[UnifiedBridge] Make sure the Ableton Remote Script is running');
    console.error('[UnifiedBridge] Will retry on first command...');
  }

  if (MODE === 'mcp') {
    // MCP mode (stdio)
    console.error('[UnifiedBridge] Starting in MCP mode (stdio)');
    const mcpServer = new AbletonMCPServer();
    await mcpServer.run();
  } else if (MODE === 'rest') {
    // REST API mode
    console.error(`[UnifiedBridge] Starting in REST API mode (port ${REST_PORT})`);
    const restAPI = new RestAPI(REST_PORT, ableton, cache);
    await restAPI.start();
  } else if (MODE === 'both') {
    // Both modes
    console.error(`[UnifiedBridge] Starting in BOTH modes (REST port ${REST_PORT})`);

    // Start REST API
    const restAPI = new RestAPI(REST_PORT, ableton, cache);
    await restAPI.start();

    // Start MCP server (this blocks)
    const mcpServer = new AbletonMCPServer();
    await mcpServer.run();
  } else {
    console.error(`[UnifiedBridge] Unknown mode: ${MODE}`);
    console.error('[UnifiedBridge] Valid modes: mcp, rest, both');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[UnifiedBridge] Fatal error:', error);
  process.exit(1);
});
