// Known problematic parameter combinations
const ISSUE_DETECTORS = [
    {
        device: 'Compressor',
        check: (params) => {
            const ratio = params.get('Ratio');
            const attack = params.get('Attack');
            if (ratio && ratio > 8)
                return `Compressor ratio at ${ratio}:1 is very high - consider 2-4:1 for techno`;
            if (attack && attack < 5)
                return `Attack at ${attack}ms is killing transients - try 10-30ms`;
            return null;
        },
    },
    {
        device: 'Limiter',
        check: (params) => {
            const gain = params.get('Gain');
            if (gain && gain > 12)
                return `Limiter gain at ${gain}dB is extreme - check for cascading limiters`;
            return null;
        },
    },
    {
        device: 'Saturator',
        check: (params) => {
            const drive = params.get('Drive');
            if (drive && drive > 20)
                return `Saturator drive at ${drive}dB is very aggressive`;
            return null;
        },
    },
    {
        device: 'EQ Eight',
        check: (params) => {
            // Check for extreme boosts
            for (const [name, value] of params) {
                if (name.includes('Gain') && Math.abs(value) > 8) {
                    return `EQ ${name} at ${value > 0 ? '+' : ''}${value}dB is extreme - try smaller moves`;
                }
            }
            return null;
        },
    },
    {
        device: 'Operator',
        check: (params) => {
            // FM amount check
            const fmB = params.get('FM From B') || params.get('B Level');
            if (fmB && fmB > 0.5)
                return `FM modulation amount is high (${Math.round(fmB * 100)}%) - can cause mud`;
            return null;
        },
    },
];
export async function analyzeDeviceChain(client, trackIndex) {
    const trackInfo = await client.sendCommand('get_track_info', { track_index: trackIndex });
    const analysis = {
        trackName: trackInfo.name,
        trackIndex,
        devices: [],
        issues: [],
        suggestions: [],
    };
    // Check for multiple compressors/limiters
    let compressorCount = 0;
    let limiterCount = 0;
    for (let i = 0; i < (trackInfo.devices?.length || 0); i++) {
        const deviceInfo = trackInfo.devices[i];
        const params = await client.sendCommand('get_device_parameters', {
            track_index: trackIndex,
            device_index: i,
        });
        const deviceAnalysis = {
            name: deviceInfo.name,
            type: deviceInfo.class_name || deviceInfo.name,
            index: i,
            parameters: params.parameters?.map((p) => ({
                name: p.name,
                value: p.value,
                normalizedValue: p.normalized_value,
                min: p.min,
                max: p.max,
            })) || [],
            issues: [],
        };
        // Count dynamics processors
        if (deviceInfo.name.includes('Compressor') || deviceInfo.name.includes('Glue')) {
            compressorCount++;
        }
        if (deviceInfo.name.includes('Limiter')) {
            limiterCount++;
        }
        // Run issue detectors
        const paramMap = new Map();
        deviceAnalysis.parameters.forEach((p) => paramMap.set(p.name, p.value));
        for (const detector of ISSUE_DETECTORS) {
            if (deviceInfo.name.includes(detector.device) || deviceInfo.class_name?.includes(detector.device)) {
                const issue = detector.check(paramMap);
                if (issue) {
                    deviceAnalysis.issues.push(issue);
                    analysis.issues.push(`${deviceInfo.name}: ${issue}`);
                }
            }
        }
        analysis.devices.push(deviceAnalysis);
    }
    // Chain-level analysis
    if (compressorCount > 2) {
        analysis.issues.push(`${compressorCount} compressors in chain - watch for over-compression`);
    }
    if (limiterCount > 1) {
        analysis.issues.push(`${limiterCount} limiters in series - this often destroys dynamics`);
        analysis.suggestions.push('Consider removing one limiter and using Utility for gain staging');
    }
    return analysis;
}
export function formatAnalysisForCoaching(analysis) {
    let output = `## Track: ${analysis.trackName}\n\n`;
    output += `**Device Chain:** ${analysis.devices.map((d) => d.name).join(' → ')}\n\n`;
    if (analysis.issues.length > 0) {
        output += `**Issues Found:**\n`;
        analysis.issues.forEach((issue) => {
            output += `- ${issue}\n`;
        });
        output += '\n';
    }
    if (analysis.suggestions.length > 0) {
        output += `**Suggestions:**\n`;
        analysis.suggestions.forEach((s) => {
            output += `- ${s}\n`;
        });
    }
    if (analysis.issues.length === 0) {
        output += `No obvious issues detected in device chain.\n`;
    }
    return output;
}
//# sourceMappingURL=device-analyzer.js.map