import { AbletonClient } from '../ableton-client.js';
export interface DeviceChainAnalysis {
    trackName: string;
    trackIndex: number;
    devices: DeviceAnalysis[];
    issues: string[];
    suggestions: string[];
}
export interface DeviceAnalysis {
    name: string;
    type: string;
    index: number;
    parameters: ParameterState[];
    issues: string[];
}
export interface ParameterState {
    name: string;
    value: number;
    normalizedValue: number;
    min: number;
    max: number;
}
export declare function analyzeDeviceChain(client: AbletonClient, trackIndex: number): Promise<DeviceChainAnalysis>;
export declare function formatAnalysisForCoaching(analysis: DeviceChainAnalysis): string;
//# sourceMappingURL=device-analyzer.d.ts.map