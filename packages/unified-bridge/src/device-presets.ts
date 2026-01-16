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

export const DEVICE_PRESETS: DevicePresets = {
  granulator: {
    small_grains: {
      name: 'Small Grains',
      description: 'Tight, stuttery grains for glitch textures',
      parameters: {
        'Grain Size': 0.1,
        Spray: 0.2,
        Frequency: 0.5,
        'Random Pitch': 0.1,
      },
    },
    large_clouds: {
      name: 'Large Clouds',
      description: 'Ambient, pad-like clouds',
      parameters: {
        'Grain Size': 0.8,
        Spray: 0.7,
        Frequency: 0.3,
        'Random Pitch': 0.4,
      },
    },
    rhythmic_chop: {
      name: 'Rhythmic Chop',
      description: 'Synced rhythmic chopping',
      parameters: {
        'Grain Size': 0.25,
        Spray: 0.1,
        Frequency: 0.75,
        'Random Pitch': 0.0,
      },
    },
  },
  wavetable: {
    warm_pad: {
      name: 'Warm Pad',
      description: 'Smooth, warm pad sound',
      parameters: {
        'Filter Freq': 0.4,
        'Filter Res': 0.2,
        'Filter Type': 0.0,
        'Sub Osc': 0.3,
      },
    },
    aggressive_lead: {
      name: 'Aggressive Lead',
      description: 'Cutting lead sound',
      parameters: {
        'Filter Freq': 0.7,
        'Filter Res': 0.6,
        'Filter Type': 0.5,
        'Sub Osc': 0.0,
      },
    },
  },
  autofilter: {
    slow_sweep: {
      name: 'Slow Sweep',
      description: 'Slow filter sweep',
      parameters: {
        Frequency: 0.3,
        Resonance: 0.4,
        'LFO Amount': 0.6,
        'LFO Rate': 0.2,
      },
    },
    wobble_bass: {
      name: 'Wobble Bass',
      description: 'Classic dubstep wobble',
      parameters: {
        Frequency: 0.5,
        Resonance: 0.7,
        'LFO Amount': 0.8,
        'LFO Rate': 0.5,
      },
    },
  },
};

export function getPreset(deviceType: string, presetName: string): DevicePreset | null {
  const devicePresets = DEVICE_PRESETS[deviceType.toLowerCase()];
  if (!devicePresets) return null;
  return devicePresets[presetName.toLowerCase()] || null;
}

export function listPresets(deviceType?: string): string[] {
  if (deviceType) {
    const presets = DEVICE_PRESETS[deviceType.toLowerCase()];
    return presets ? Object.keys(presets) : [];
  }
  return Object.keys(DEVICE_PRESETS);
}
