/**
 * TCP client for communicating with Ableton Live Remote Script
 */
export interface AbletonCommand {
    type: string;
    params?: Record<string, any>;
}
export interface AbletonResponse {
    status: 'success' | 'error';
    result?: any;
    message?: string;
}
export declare class AbletonClient {
    private socket;
    private readonly host;
    private readonly port;
    private connectionAttempts;
    private readonly maxAttempts;
    constructor(host?: string, port?: number);
    /**
     * Connect to Ableton Remote Script
     */
    connect(): Promise<boolean>;
    /**
     * Disconnect from Ableton
     */
    disconnect(): void;
    /**
     * Send command to Ableton and return response
     */
    sendCommand(commandType: string, params?: Record<string, any>): Promise<any>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
//# sourceMappingURL=ableton-client.d.ts.map