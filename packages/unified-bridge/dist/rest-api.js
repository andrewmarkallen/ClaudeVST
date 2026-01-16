/**
 * REST API server for C++ VST adapter
 * Exposes the same functionality as MCP tools via HTTP
 */
import Fastify from 'fastify';
import { getPreset, DEVICE_PRESETS } from './device-presets.js';
export class RestAPI {
    app = Fastify({ logger: false });
    ableton;
    cache;
    port;
    constructor(port = 8080, ableton, cache) {
        this.port = port;
        this.ableton = ableton;
        this.cache = cache;
        this.setupRoutes();
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', async () => {
            return {
                status: 'ok',
                connected: this.ableton.isConnected(),
                cache: this.cache.getCacheStats(),
            };
        });
        // Session endpoints (delta-optimized)
        this.app.get('/session/info', async () => {
            try {
                const state = await this.ableton.sendCommand('get_session_info');
                return state;
            }
            catch (error) {
                throw new Error(`Failed to get session info: ${error}`);
            }
        });
        this.app.get('/session/delta', async () => {
            try {
                const state = await this.ableton.sendCommand('get_session_info');
                return this.cache.getSessionDelta(state);
            }
            catch (error) {
                throw new Error(`Failed to get session delta: ${error}`);
            }
        });
        // Track endpoints (delta-optimized)
        this.app.get('/track/:trackIndex/info', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const state = await this.ableton.sendCommand('get_track_info', {
                    track_index: trackIndex,
                });
                return state;
            }
            catch (error) {
                throw new Error(`Failed to get track info: ${error}`);
            }
        });
        this.app.get('/track/:trackIndex/delta', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const state = await this.ableton.sendCommand('get_track_info', {
                    track_index: trackIndex,
                });
                return this.cache.getTrackDelta(trackIndex, state);
            }
            catch (error) {
                throw new Error(`Failed to get track delta: ${error}`);
            }
        });
        // Device endpoints (delta-optimized)
        this.app.get('/track/:trackIndex/device/:deviceIndex/parameters', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const state = await this.ableton.sendCommand('get_device_parameters', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                });
                return state;
            }
            catch (error) {
                throw new Error(`Failed to get device parameters: ${error}`);
            }
        });
        this.app.get('/track/:trackIndex/device/:deviceIndex/delta', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const state = await this.ableton.sendCommand('get_device_parameters', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                });
                return this.cache.getDeviceDelta(trackIndex, deviceIndex, state);
            }
            catch (error) {
                throw new Error(`Failed to get device delta: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/device/:deviceIndex/parameter/:paramIndex', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const paramIndex = parseInt(request.params.paramIndex, 10);
                const { value } = request.body;
                const result = await this.ableton.sendCommand('set_device_parameter', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                    param_index: paramIndex,
                    value,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to set device parameter: ${error}`);
            }
        });
        // Transport endpoints
        this.app.post('/transport/tempo', async (request) => {
            try {
                const { tempo } = request.body;
                const result = await this.ableton.sendCommand('set_tempo', { tempo });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to set tempo: ${error}`);
            }
        });
        this.app.post('/transport/play', async () => {
            try {
                const result = await this.ableton.sendCommand('start_playback');
                return result;
            }
            catch (error) {
                throw new Error(`Failed to start playback: ${error}`);
            }
        });
        this.app.post('/transport/stop', async () => {
            try {
                const result = await this.ableton.sendCommand('stop_playback');
                return result;
            }
            catch (error) {
                throw new Error(`Failed to stop playback: ${error}`);
            }
        });
        // Clip endpoints
        this.app.post('/track/:trackIndex/clip/:clipIndex/fire', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const clipIndex = parseInt(request.params.clipIndex, 10);
                const result = await this.ableton.sendCommand('fire_clip', {
                    track_index: trackIndex,
                    clip_index: clipIndex,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to fire clip: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/clip/:clipIndex/stop', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const clipIndex = parseInt(request.params.clipIndex, 10);
                const result = await this.ableton.sendCommand('stop_clip', {
                    track_index: trackIndex,
                    clip_index: clipIndex,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to stop clip: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/clip/:clipIndex/create', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const clipIndex = parseInt(request.params.clipIndex, 10);
                const { length = 4.0 } = request.body;
                const result = await this.ableton.sendCommand('create_clip', {
                    track_index: trackIndex,
                    clip_index: clipIndex,
                    length,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to create clip: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/clip/:clipIndex/notes', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const clipIndex = parseInt(request.params.clipIndex, 10);
                const { notes } = request.body;
                const result = await this.ableton.sendCommand('add_notes_to_clip', {
                    track_index: trackIndex,
                    clip_index: clipIndex,
                    notes,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to add notes: ${error}`);
            }
        });
        // Track operations
        this.app.post('/track/create', async (request) => {
            try {
                const { index = -1 } = request.body;
                const result = await this.ableton.sendCommand('create_midi_track', { index });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to create track: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/name', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const { name } = request.body;
                const result = await this.ableton.sendCommand('set_track_name', {
                    track_index: trackIndex,
                    name,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to set track name: ${error}`);
            }
        });
        // Browser endpoints
        this.app.get('/browser/tree', async (request) => {
            try {
                const { category_type = 'all' } = request.query;
                const result = await this.ableton.sendCommand('get_browser_tree', { category_type });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to get browser tree: ${error}`);
            }
        });
        this.app.get('/browser/items', async (request) => {
            try {
                const { path } = request.query;
                const result = await this.ableton.sendCommand('get_browser_items_at_path', { path });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to get browser items: ${error}`);
            }
        });
        this.app.post('/track/:trackIndex/load', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const { uri } = request.body;
                const result = await this.ableton.sendCommand('load_browser_item', {
                    track_index: trackIndex,
                    item_uri: uri,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to load instrument/effect: ${error}`);
            }
        });
        // Return/Master tracks
        this.app.get('/return-tracks', async () => {
            try {
                const result = await this.ableton.sendCommand('get_return_tracks', {});
                return result;
            }
            catch (error) {
                throw new Error(`Failed to get return tracks: ${error}`);
            }
        });
        this.app.get('/master-track', async () => {
            try {
                const result = await this.ableton.sendCommand('get_master_track', {});
                return result;
            }
            catch (error) {
                throw new Error(`Failed to get master track: ${error}`);
            }
        });
        // Parameter by name
        this.app.get('/track/:trackIndex/device/:deviceIndex/parameter-by-name', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const paramName = request.query.name;
                const result = await this.ableton.sendCommand('get_parameter_by_name', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                    param_name: paramName,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to get parameter by name: ${error}`);
            }
        });
        // Batch parameter set
        this.app.post('/track/:trackIndex/device/:deviceIndex/parameters-batch', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const result = await this.ableton.sendCommand('set_parameters_batch', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                    param_values: request.body,
                });
                return result;
            }
            catch (error) {
                throw new Error(`Failed to set parameters batch: ${error}`);
            }
        });
        // Cache management
        this.app.post('/cache/reset', async (request) => {
            try {
                const { scope = 'all' } = request.body;
                this.cache.resetCache(scope);
                return { message: `Cache reset: ${scope}` };
            }
            catch (error) {
                throw new Error(`Failed to reset cache: ${error}`);
            }
        });
        this.app.get('/cache/stats', async () => {
            return this.cache.getCacheStats();
        });
        // Device presets
        this.app.get('/presets', async () => {
            return DEVICE_PRESETS;
        });
        this.app.get('/presets/:deviceType', async (request) => {
            const presets = DEVICE_PRESETS[request.params.deviceType.toLowerCase()];
            if (!presets) {
                return { error: 'Device type not found' };
            }
            return presets;
        });
        this.app.get('/presets/:deviceType/:presetName', async (request) => {
            const preset = getPreset(request.params.deviceType, request.params.presetName);
            if (!preset) {
                return { error: `Preset not found: ${request.params.deviceType}/${request.params.presetName}` };
            }
            return preset;
        });
        this.app.post('/track/:trackIndex/device/:deviceIndex/preset', async (request) => {
            try {
                const trackIndex = parseInt(request.params.trackIndex, 10);
                const deviceIndex = parseInt(request.params.deviceIndex, 10);
                const { device_type, preset_name } = request.body;
                const preset = getPreset(device_type, preset_name);
                if (!preset) {
                    return { error: `Preset not found: ${device_type}/${preset_name}` };
                }
                const result = await this.ableton.sendCommand('set_parameters_batch', {
                    track_index: trackIndex,
                    device_index: deviceIndex,
                    param_values: preset.parameters,
                });
                return {
                    preset: preset.name,
                    description: preset.description,
                    result,
                };
            }
            catch (error) {
                throw new Error(`Failed to apply preset: ${error}`);
            }
        });
        // Generic command endpoint for VST adapter
        this.app.post('/command', async (request) => {
            try {
                const { command, args } = request.body;
                const result = await this.ableton.sendCommand(command, args);
                return result;
            }
            catch (error) {
                throw new Error(`Command '${request.body.command}' failed: ${error}`);
            }
        });
        // Audio analysis endpoint
        this.app.post('/analyze', async (request) => {
            try {
                const { audio_path } = request.body;
                // Lazy import to avoid circular dependencies
                const { analysisService } = await import('./analysis-service.js');
                const result = await analysisService.analyzeTrack(audio_path);
                return result;
            }
            catch (error) {
                throw new Error(`Analysis failed: ${error}`);
            }
        });
        // Error handler
        this.app.setErrorHandler((error, request, reply) => {
            console.error('[RestAPI] Error:', error);
            const message = error instanceof Error ? error.message : 'Internal server error';
            reply.status(500).send({
                error: message,
            });
        });
    }
    async start() {
        try {
            await this.app.listen({ port: this.port, host: 'localhost' });
            console.log(`[RestAPI] Server listening on http://localhost:${this.port}`);
        }
        catch (error) {
            console.error('[RestAPI] Failed to start server:', error);
            throw error;
        }
    }
    async stop() {
        await this.app.close();
    }
}
//# sourceMappingURL=rest-api.js.map