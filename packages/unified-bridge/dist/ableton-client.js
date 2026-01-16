/**
 * TCP client for communicating with Ableton Live Remote Script
 */
import { Socket } from 'net';
export class AbletonClient {
    socket = null;
    host;
    port;
    connectionAttempts = 0;
    maxAttempts = 3;
    constructor(host = 'localhost', port = 9877) {
        this.host = host;
        this.port = port;
    }
    /**
     * Connect to Ableton Remote Script
     */
    async connect() {
        if (this.socket) {
            return true;
        }
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                console.log(`[AbletonClient] Connecting to Ableton (attempt ${attempt}/${this.maxAttempts})...`);
                await new Promise((resolve, reject) => {
                    this.socket = new Socket();
                    this.socket.setTimeout(10000);
                    this.socket.on('connect', () => {
                        console.log('[AbletonClient] Connected to Ableton');
                        resolve();
                    });
                    this.socket.on('error', (err) => {
                        reject(err);
                    });
                    this.socket.connect(this.port, this.host);
                });
                // Validate connection with a simple command
                try {
                    await this.sendCommand('get_session_info');
                    console.log('[AbletonClient] Connection validated');
                    this.connectionAttempts = 0;
                    return true;
                }
                catch (error) {
                    console.error('[AbletonClient] Connection validation failed:', error);
                    this.disconnect();
                }
            }
            catch (error) {
                console.error(`[AbletonClient] Connection attempt ${attempt} failed:`, error);
                this.disconnect();
                if (attempt < this.maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
        }
        throw new Error('Could not connect to Ableton. Make sure the Remote Script is running.');
    }
    /**
     * Disconnect from Ableton
     */
    disconnect() {
        if (this.socket) {
            try {
                this.socket.destroy();
            }
            catch (error) {
                console.error('[AbletonClient] Error disconnecting:', error);
            }
            finally {
                this.socket = null;
            }
        }
    }
    /**
     * Send command to Ableton and return response
     */
    async sendCommand(commandType, params) {
        if (!this.socket) {
            await this.connect();
        }
        if (!this.socket) {
            throw new Error('Not connected to Ableton');
        }
        const command = {
            type: commandType,
            params: params || {},
        };
        console.error(`[AbletonClient] Sending command: ${JSON.stringify(command)}`);
        return new Promise((resolve, reject) => {
            let buffer = '';
            const timeout = setTimeout(() => {
                this.socket = null;
                reject(new Error('Timeout waiting for Ableton response'));
            }, 15000);
            const onData = (data) => {
                buffer += data.toString('utf-8');
                try {
                    const response = JSON.parse(buffer);
                    clearTimeout(timeout);
                    this.socket?.removeListener('data', onData);
                    this.socket?.removeListener('error', onError);
                    if (response.status === 'error') {
                        reject(new Error(response.message || 'Unknown error from Ableton'));
                    }
                    else {
                        resolve(response.result || {});
                    }
                }
                catch (error) {
                    // Incomplete JSON, wait for more data
                }
            };
            const onError = (error) => {
                clearTimeout(timeout);
                this.socket = null;
                reject(error);
            };
            this.socket.on('data', onData);
            this.socket.once('error', onError);
            // Send command
            const commandJson = JSON.stringify(command);
            this.socket.write(commandJson);
        });
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.socket !== null && !this.socket.destroyed;
    }
}
//# sourceMappingURL=ableton-client.js.map