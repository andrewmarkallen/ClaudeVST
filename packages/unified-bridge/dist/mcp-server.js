/**
 * MCP Server for Ableton control with delta caching
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { AbletonClient } from './ableton-client.js';
import { DeltaCache } from './delta-cache.js';
import { getPreset, listPresets, DEVICE_PRESETS } from './device-presets.js';
import { findMatchingPatterns, SPECTRUM_BANDS, TECHNO_TARGETS } from './coaching/knowledge-base.js';
import { analyzeDeviceChain, formatAnalysisForCoaching } from './coaching/device-analyzer.js';
export class AbletonMCPServer {
    server;
    ableton;
    cache;
    constructor() {
        this.server = new Server({
            name: 'ableton-unified-bridge',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.ableton = new AbletonClient();
        this.cache = new DeltaCache();
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                // Session queries
                {
                    name: 'get_session_info',
                    description: 'Get detailed information about the current Ableton session (full state). ⚡ Prefer get_session_delta for repeated queries (85-95% token savings).',
                    inputSchema: { type: 'object', properties: {} },
                },
                {
                    name: 'get_session_delta',
                    description: 'Get session info with delta optimization (returns only changes since last call, 85-95% token savings)',
                    inputSchema: { type: 'object', properties: {} },
                },
                // Track queries
                {
                    name: 'get_track_info',
                    description: 'Get detailed information about a specific track. ⚡ Prefer get_track_delta for repeated queries.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                        },
                        required: ['track_index'],
                    },
                },
                {
                    name: 'get_track_delta',
                    description: 'Get track info with delta optimization',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                        },
                        required: ['track_index'],
                    },
                },
                // Device queries
                {
                    name: 'get_device_parameters',
                    description: 'Get all parameters for a device on a track. ⚡ Prefer get_device_delta for repeated queries.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            device_index: { type: 'number', description: 'Index of the device' },
                        },
                        required: ['track_index', 'device_index'],
                    },
                },
                {
                    name: 'get_device_delta',
                    description: 'Get device parameters with delta optimization',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            device_index: { type: 'number', description: 'Index of the device' },
                        },
                        required: ['track_index', 'device_index'],
                    },
                },
                {
                    name: 'set_device_parameter',
                    description: 'Set a device parameter value',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            device_index: { type: 'number', description: 'Index of the device' },
                            param_index: { type: 'number', description: 'Index of the parameter' },
                            value: { type: 'number', description: 'New parameter value' },
                        },
                        required: ['track_index', 'device_index', 'param_index', 'value'],
                    },
                },
                // Track operations
                {
                    name: 'create_midi_track',
                    description: 'Create a new MIDI track',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            index: { type: 'number', description: 'Index to insert at (-1 for end)', default: -1 },
                        },
                    },
                },
                {
                    name: 'set_track_name',
                    description: 'Set the name of a track',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            name: { type: 'string', description: 'New track name' },
                        },
                        required: ['track_index', 'name'],
                    },
                },
                // Audio Track Creation
                {
                    name: 'create_audio_track',
                    description: 'Create a new audio track',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            index: { type: 'number', description: 'Index to insert at (-1 for end)', default: -1 },
                        },
                    },
                },
                // Session View Audio Clips
                {
                    name: 'create_audio_clip_session',
                    description: 'Create an audio clip in a session view clip slot from a file path',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the audio track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            file_path: { type: 'string', description: 'Absolute path to the audio file' },
                        },
                        required: ['track_index', 'clip_index', 'file_path'],
                    },
                },
                // Arrangement View Audio Clips
                {
                    name: 'create_audio_clip_arrangement',
                    description: 'Create an audio clip in arrangement view at a position',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the audio track' },
                            file_path: { type: 'string', description: 'Absolute path to the audio file' },
                            position: { type: 'number', description: 'Position in beats', default: 0 },
                        },
                        required: ['track_index', 'file_path'],
                    },
                },
                // Clip Color
                {
                    name: 'set_clip_color',
                    description: 'Set the color of a clip (0-69 color palette index)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            color_index: { type: 'number', description: 'Color index (0-69)' },
                        },
                        required: ['track_index', 'clip_index', 'color_index'],
                    },
                },
                // Clip Start/End Markers
                {
                    name: 'set_clip_start_end',
                    description: 'Set the start and end markers of a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            start_marker: { type: 'number', description: 'Start marker position in beats' },
                            end_marker: { type: 'number', description: 'End marker position in beats' },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                // Mixer controls
                {
                    name: 'set_track_volume',
                    description: 'Set track volume (0.0 to 1.0, where 0.85 = 0dB)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            volume: { type: 'number', description: 'Volume level (0.0 to 1.0, default 0.85 = 0dB)' },
                        },
                        required: ['track_index', 'volume'],
                    },
                },
                {
                    name: 'set_track_panning',
                    description: 'Set track panning (-1.0 = left, 0.0 = center, 1.0 = right)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            panning: { type: 'number', description: 'Pan position (-1.0 to 1.0)' },
                        },
                        required: ['track_index', 'panning'],
                    },
                },
                {
                    name: 'set_track_mute',
                    description: 'Set track mute state',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            mute: { type: 'boolean', description: 'Mute state (true/false)' },
                        },
                        required: ['track_index', 'mute'],
                    },
                },
                {
                    name: 'set_track_solo',
                    description: 'Set track solo state',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            solo: { type: 'boolean', description: 'Solo state (true/false)' },
                        },
                        required: ['track_index', 'solo'],
                    },
                },
                {
                    name: 'set_track_send',
                    description: 'Set track send level to a return track',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            send_index: { type: 'number', description: 'Index of the send (0 = Send A, 1 = Send B, etc.)' },
                            value: { type: 'number', description: 'Send level (0.0 to 1.0)' },
                        },
                        required: ['track_index', 'send_index', 'value'],
                    },
                },
                // Duplication
                {
                    name: 'duplicate_clip',
                    description: 'Duplicate a clip to another slot',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Source track index' },
                            clip_index: { type: 'number', description: 'Source clip slot index' },
                            target_track_index: { type: 'number', description: 'Target track index (default: same track)' },
                            target_clip_index: { type: 'number', description: 'Target clip slot index (default: next slot)' },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                {
                    name: 'duplicate_track',
                    description: 'Duplicate an entire track with all clips and devices',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of track to duplicate' },
                        },
                        required: ['track_index'],
                    },
                },
                {
                    name: 'duplicate_scene',
                    description: 'Duplicate a scene (row of clips)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            scene_index: { type: 'number', description: 'Index of scene to duplicate' },
                        },
                        required: ['scene_index'],
                    },
                },
                // Clip operations
                {
                    name: 'create_clip',
                    description: 'Create a new MIDI clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            length: { type: 'number', description: 'Length in beats', default: 4.0 },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                {
                    name: 'add_notes_to_clip',
                    description: 'Add MIDI notes to a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            notes: {
                                type: 'array',
                                description: 'Array of notes with pitch, start_time, duration, velocity, mute',
                                items: { type: 'object' },
                            },
                        },
                        required: ['track_index', 'clip_index', 'notes'],
                    },
                },
                {
                    name: 'set_clip_name',
                    description: 'Set the name of a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            name: { type: 'string', description: 'New clip name' },
                        },
                        required: ['track_index', 'clip_index', 'name'],
                    },
                },
                {
                    name: 'fire_clip',
                    description: 'Start playing a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                {
                    name: 'stop_clip',
                    description: 'Stop playing a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                // Transport
                {
                    name: 'set_tempo',
                    description: 'Set the session tempo',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tempo: { type: 'number', description: 'Tempo in BPM' },
                        },
                        required: ['tempo'],
                    },
                },
                {
                    name: 'start_playback',
                    description: 'Start playing the session',
                    inputSchema: { type: 'object', properties: {} },
                },
                {
                    name: 'stop_playback',
                    description: 'Stop playing the session',
                    inputSchema: { type: 'object', properties: {} },
                },
                // Automation
                {
                    name: 'get_clip_automation',
                    description: 'Get available automation envelopes for a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                        },
                        required: ['track_index', 'clip_index'],
                    },
                },
                {
                    name: 'add_automation_point',
                    description: 'Add an automation breakpoint to a clip envelope',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            device_index: { type: 'number', description: 'Index of the device' },
                            param_index: { type: 'number', description: 'Index of the parameter' },
                            time: { type: 'number', description: 'Time in beats within the clip' },
                            value: { type: 'number', description: 'Parameter value at this point' },
                        },
                        required: ['track_index', 'clip_index', 'device_index', 'param_index', 'time', 'value'],
                    },
                },
                {
                    name: 'clear_automation',
                    description: 'Clear all automation points for a parameter in a clip',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the clip slot' },
                            device_index: { type: 'number', description: 'Index of the device' },
                            param_index: { type: 'number', description: 'Index of the parameter' },
                        },
                        required: ['track_index', 'clip_index', 'device_index', 'param_index'],
                    },
                },
                // Arrangement
                {
                    name: 'get_arrangement_clips',
                    description: 'Get all clips in the arrangement view for a track',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                        },
                        required: ['track_index'],
                    },
                },
                {
                    name: 'place_clip_in_arrangement',
                    description: 'Place a session clip into the arrangement view at specified bars',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            clip_index: { type: 'number', description: 'Index of the session clip slot' },
                            start_bar: { type: 'number', description: 'Starting bar number' },
                            end_bar: { type: 'number', description: 'Ending bar number' },
                        },
                        required: ['track_index', 'clip_index', 'start_bar', 'end_bar'],
                    },
                },
                {
                    name: 'delete_arrangement_clip',
                    description: 'Delete a clip from the arrangement view',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            arrangement_clip_index: { type: 'number', description: 'Index of the arrangement clip' },
                        },
                        required: ['track_index', 'arrangement_clip_index'],
                    },
                },
                {
                    name: 'set_arrangement_loop',
                    description: 'Set the arrangement loop brace',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            start_bar: { type: 'number', description: 'Starting bar number' },
                            end_bar: { type: 'number', description: 'Ending bar number' },
                            enabled: { type: 'boolean', description: 'Whether loop is enabled' },
                        },
                        required: ['start_bar', 'end_bar', 'enabled'],
                    },
                },
                // Browser
                {
                    name: 'get_browser_tree',
                    description: '⚠️ EXPENSIVE: Returns full browser tree (can be 100k+ tokens). Use get_browser_items_at_path instead for targeted browsing.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            category_type: {
                                type: 'string',
                                description: 'Type of categories',
                                default: 'all',
                            },
                        },
                    },
                },
                {
                    name: 'get_browser_items_at_path',
                    description: 'Get browser items at a path',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Browser path' },
                        },
                        required: ['path'],
                    },
                },
                {
                    name: 'load_instrument_or_effect',
                    description: 'Load an instrument or effect by URI',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            uri: { type: 'string', description: 'Browser item URI' },
                        },
                        required: ['track_index', 'uri'],
                    },
                },
                // Return/Master tracks
                {
                    name: 'get_return_tracks',
                    description: 'Get all return tracks with devices',
                    inputSchema: { type: 'object', properties: {} },
                },
                {
                    name: 'get_master_track',
                    description: 'Get master track with devices',
                    inputSchema: { type: 'object', properties: {} },
                },
                // Parameter operations
                {
                    name: 'get_parameter_by_name',
                    description: 'Find device parameters by name',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            device_index: { type: 'number', description: 'Index of the device' },
                            param_name: { type: 'string', description: 'Parameter name to search for' },
                        },
                        required: ['track_index', 'device_index', 'param_name'],
                    },
                },
                {
                    name: 'set_parameters_batch',
                    description: 'Set multiple parameters at once',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Index of the track' },
                            device_index: { type: 'number', description: 'Index of the device' },
                            param_values: { type: 'object', description: 'Object mapping param names to values' },
                        },
                        required: ['track_index', 'device_index', 'param_values'],
                    },
                },
                // Cache management
                {
                    name: 'reset_delta_cache',
                    description: 'Reset delta cache to force full state on next query',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            scope: {
                                type: 'string',
                                description: 'Cache scope to reset',
                                enum: ['all', 'session', 'tracks', 'devices'],
                                default: 'all',
                            },
                        },
                    },
                },
                {
                    name: 'get_cache_stats',
                    description: 'Get delta cache statistics',
                    inputSchema: { type: 'object', properties: {} },
                },
                // Device presets
                {
                    name: 'load_device_preset',
                    description: 'Apply a preset to a device',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Track index' },
                            device_index: { type: 'number', description: 'Device index' },
                            device_type: {
                                type: 'string',
                                description: 'Device type (granulator, wavetable, autofilter)',
                            },
                            preset_name: { type: 'string', description: 'Preset name' },
                        },
                        required: ['track_index', 'device_index', 'device_type', 'preset_name'],
                    },
                },
                {
                    name: 'list_device_presets',
                    description: 'List available presets for devices',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            device_type: {
                                type: 'string',
                                description: 'Device type (optional, omit to list all device types)',
                            },
                        },
                    },
                },
                // Coaching tools
                {
                    name: 'diagnose_sound_issue',
                    description: 'Diagnose a sound issue using device parameters and audio analysis. Describe the symptom (e.g., "kick sounds muddy", "harsh highs")',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            symptom: { type: 'string', description: 'Description of what sounds wrong' },
                            track_index: {
                                type: 'number',
                                description: 'Track to analyze (optional, analyzes all if not specified)',
                            },
                        },
                        required: ['symptom'],
                    },
                },
                {
                    name: 'analyze_track_chain',
                    description: 'Analyze device chain on a track for potential issues',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            track_index: { type: 'number', description: 'Track index to analyze' },
                        },
                        required: ['track_index'],
                    },
                },
                {
                    name: 'compare_to_target',
                    description: 'Compare current audio analysis to techno production targets',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            analysis_json: { type: 'string', description: 'Contents of audio_analysis.json' },
                        },
                        required: ['analysis_json'],
                    },
                },
            ],
        }));
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                // Delta tools
                if (name === 'get_session_delta') {
                    const state = await this.ableton.sendCommand('get_session_info');
                    const delta = this.cache.getSessionDelta(state);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(delta, null, 2) }],
                    };
                }
                if (name === 'get_track_delta') {
                    const params = args || {};
                    const state = await this.ableton.sendCommand('get_track_info', params);
                    const delta = this.cache.getTrackDelta(params.track_index, state);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(delta, null, 2) }],
                    };
                }
                if (name === 'get_device_delta') {
                    const params = args || {};
                    const state = await this.ableton.sendCommand('get_device_parameters', params);
                    const delta = this.cache.getDeviceDelta(params.track_index, params.device_index, state);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(delta, null, 2) }],
                    };
                }
                // Cache management
                if (name === 'reset_delta_cache') {
                    this.cache.resetCache(args?.scope || 'all');
                    return {
                        content: [{ type: 'text', text: `Cache reset: ${args?.scope || 'all'}` }],
                    };
                }
                if (name === 'get_cache_stats') {
                    const stats = this.cache.getCacheStats();
                    return {
                        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
                    };
                }
                // Device presets
                if (name === 'load_device_preset') {
                    const params = args;
                    const preset = getPreset(params.device_type, params.preset_name);
                    if (!preset) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Preset not found: ${params.device_type}/${params.preset_name}`,
                                },
                            ],
                        };
                    }
                    const result = await this.ableton.sendCommand('set_parameters_batch', {
                        track_index: params.track_index,
                        device_index: params.device_index,
                        param_values: preset.parameters,
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Applied ${preset.name}: ${preset.description}\n${JSON.stringify(result, null, 2)}`,
                            },
                        ],
                    };
                }
                if (name === 'list_device_presets') {
                    const params = args;
                    if (params.device_type) {
                        const presets = listPresets(params.device_type);
                        if (presets.length === 0) {
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `No presets found for device type: ${params.device_type}`,
                                    },
                                ],
                            };
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Presets for ${params.device_type}: ${presets.join(', ')}`,
                                },
                            ],
                        };
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Device types: ${Object.keys(DEVICE_PRESETS).join(', ')}`,
                            },
                        ],
                    };
                }
                // Coaching tools
                if (name === 'diagnose_sound_issue') {
                    const params = args;
                    let output = `# Sound Diagnosis: "${params.symptom}"\n\n`;
                    // Find matching diagnostic patterns
                    const patterns = findMatchingPatterns(params.symptom);
                    if (patterns.length > 0) {
                        output += `## Likely Causes\n\n`;
                        patterns.forEach((pattern, i) => {
                            output += `### ${i + 1}. ${pattern.rootCauses[0]}\n\n`;
                            output += `**Other possible causes:**\n`;
                            pattern.rootCauses.slice(1).forEach((cause) => {
                                output += `- ${cause}\n`;
                            });
                            output += `\n**Recommended fixes:**\n`;
                            pattern.fixes.forEach((fix) => {
                                const rangeStr = Array.isArray(fix.range)
                                    ? `${fix.range[0]}-${fix.range[1]}`
                                    : fix.range;
                                output += `- ${fix.device} → ${fix.parameter}: ${fix.action} to ${rangeStr}\n`;
                            });
                            output += `\n**Why this works:** ${pattern.explanation}\n\n`;
                        });
                    }
                    else {
                        output += `No specific patterns matched. Let me analyze your device chain...\n\n`;
                    }
                    // Analyze device chain if track specified
                    if (params.track_index !== undefined) {
                        try {
                            const analysis = await analyzeDeviceChain(this.ableton, params.track_index);
                            output += formatAnalysisForCoaching(analysis);
                        }
                        catch (e) {
                            output += `Could not analyze track ${params.track_index}: ${e}\n`;
                        }
                    }
                    return { content: [{ type: 'text', text: output }] };
                }
                if (name === 'analyze_track_chain') {
                    const params = args;
                    const analysis = await analyzeDeviceChain(this.ableton, params.track_index);
                    return { content: [{ type: 'text', text: formatAnalysisForCoaching(analysis) }] };
                }
                if (name === 'compare_to_target') {
                    const params = args;
                    const analysis = JSON.parse(params.analysis_json);
                    let output = `# Mix Analysis vs Techno Targets\n\n`;
                    // Levels
                    const rmsAvg = (analysis.levels.rms_left_db + analysis.levels.rms_right_db) / 2;
                    const peakAvg = (analysis.levels.peak_left_db + analysis.levels.peak_right_db) / 2;
                    const crest = analysis.levels.crest_factor_db;
                    output += `## Dynamics\n`;
                    output += `- **RMS Level:** ${rmsAvg.toFixed(1)} dB\n`;
                    output += `- **Peak Level:** ${peakAvg.toFixed(1)} dB\n`;
                    output += `- **Crest Factor:** ${crest.toFixed(1)} dB `;
                    if (crest < TECHNO_TARGETS.crestFactor.min) {
                        output += `⚠️ Too compressed (target: ${TECHNO_TARGETS.crestFactor.min}-${TECHNO_TARGETS.crestFactor.max} dB)\n`;
                    }
                    else if (crest > TECHNO_TARGETS.crestFactor.max) {
                        output += `(very dynamic for techno)\n`;
                    }
                    else {
                        output += `✓ Good for techno\n`;
                    }
                    // Spectrum balance
                    output += `\n## Spectrum\n`;
                    const spectrum = analysis.spectrum;
                    output += `| Band | Level | Notes |\n`;
                    output += `|------|-------|-------|\n`;
                    const bands = [
                        ['Sub (20-60Hz)', spectrum.sub_db, SPECTRUM_BANDS.sub.role],
                        ['Bass (60-250Hz)', spectrum.bass_db, SPECTRUM_BANDS.bass.role],
                        ['Low-Mid (250-500Hz)', spectrum.low_mid_db, SPECTRUM_BANDS.lowMid.role],
                        ['Mid (500-2kHz)', spectrum.mid_db, SPECTRUM_BANDS.mid.role],
                        ['Upper-Mid (2-4kHz)', spectrum.upper_mid_db, SPECTRUM_BANDS.upperMid.role],
                        ['Presence (4-6kHz)', spectrum.presence_db, SPECTRUM_BANDS.presence.role],
                        ['Brilliance (6-12kHz)', spectrum.brilliance_db, SPECTRUM_BANDS.brilliance.role],
                        ['Air (12-20kHz)', spectrum.air_db, SPECTRUM_BANDS.air.role],
                    ];
                    bands.forEach(([name, level, role]) => {
                        output += `| ${name} | ${level.toFixed(1)} dB | ${role} |\n`;
                    });
                    // Sub to bass ratio check
                    const subBassDelta = spectrum.sub_db - spectrum.bass_db;
                    if (subBassDelta > TECHNO_TARGETS.subToBassDelta.max) {
                        output += `\n⚠️ Sub is ${subBassDelta.toFixed(1)} dB louder than bass - may cause mud on some systems\n`;
                    }
                    return { content: [{ type: 'text', text: output }] };
                }
                // Pass through all other commands to Ableton
                const result = await this.ableton.sendCommand(name, args);
                const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                // Add size warning for expensive operations
                if (name === 'get_browser_tree' && resultText.length > 50000) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `⚠️ WARNING: Response is ${Math.round(resultText.length / 1000)}k chars (~${Math.round(resultText.length / 4000)} tokens). Consider using get_browser_items_at_path for targeted browsing.\n\n${resultText}`,
                            },
                        ],
                    };
                }
                return {
                    content: [{ type: 'text', text: resultText }],
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: 'text', text: `Error: ${errorMessage}` }],
                    isError: true,
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('[AbletonMCPServer] Server running on stdio');
    }
}
//# sourceMappingURL=mcp-server.js.map