export interface DiagnosticPattern {
    symptoms: string[];
    rootCauses: string[];
    fixes: ParameterFix[];
    explanation: string;
}
export interface ParameterFix {
    device: string;
    parameter: string;
    range: [number, number] | string;
    action: 'set' | 'reduce' | 'increase' | 'check';
}
export declare const DIAGNOSTIC_PATTERNS: DiagnosticPattern[];
export declare const SPECTRUM_BANDS: {
    sub: {
        range: string;
        role: string;
    };
    bass: {
        range: string;
        role: string;
    };
    lowMid: {
        range: string;
        role: string;
    };
    mid: {
        range: string;
        role: string;
    };
    upperMid: {
        range: string;
        role: string;
    };
    presence: {
        range: string;
        role: string;
    };
    brilliance: {
        range: string;
        role: string;
    };
    air: {
        range: string;
        role: string;
    };
};
export declare const TECHNO_TARGETS: {
    masterLufs: {
        min: number;
        max: number;
        unit: string;
    };
    crestFactor: {
        min: number;
        max: number;
        unit: string;
    };
    subToBassDelta: {
        max: number;
        unit: string;
        note: string;
    };
};
export declare function findMatchingPatterns(symptomText: string): DiagnosticPattern[];
//# sourceMappingURL=knowledge-base.d.ts.map