/**
 * Device presets for common Ableton instruments and effects
 * These define parameter values that can be applied via set_parameters_batch
 */
export interface DevicePreset {
    name: string;
    description: string;
    parameters: Record<string, number>;
}
export interface DevicePresets {
    [deviceType: string]: {
        [presetName: string]: DevicePreset;
    };
}
export declare const DEVICE_PRESETS: DevicePresets;
export declare function getPreset(deviceType: string, presetName: string): DevicePreset | null;
export declare function listPresets(deviceType?: string): string[];
//# sourceMappingURL=device-presets.d.ts.map