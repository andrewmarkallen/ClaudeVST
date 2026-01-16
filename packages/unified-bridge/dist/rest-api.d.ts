/**
 * REST API server for C++ VST adapter
 * Exposes the same functionality as MCP tools via HTTP
 */
import { AbletonClient } from './ableton-client.js';
import { DeltaCache } from './delta-cache.js';
export declare class RestAPI {
    private app;
    private ableton;
    private cache;
    private port;
    constructor(port: number | undefined, ableton: AbletonClient, cache: DeltaCache);
    private setupRoutes;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=rest-api.d.ts.map