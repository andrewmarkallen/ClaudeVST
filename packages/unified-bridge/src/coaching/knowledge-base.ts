// Domain knowledge for techno/electronic music production coaching
// Pattern: symptom → root causes → specific fixes → explanations

export interface DiagnosticPattern {
  symptoms: string[]; // Keywords that trigger this pattern
  rootCauses: string[];
  fixes: ParameterFix[];
  explanation: string;
}

export interface ParameterFix {
  device: string; // e.g., "Saturator", "Compressor", "EQ Eight"
  parameter: string; // e.g., "Drive", "Ratio", "Frequency"
  range: [number, number] | string; // e.g., [4, 8] for "4-8 dB" or "below 50 Hz"
  action: 'set' | 'reduce' | 'increase' | 'check';
}

export const DIAGNOSTIC_PATTERNS: DiagnosticPattern[] = [
  // Kick & Low End Issues
  {
    symptoms: ['muddy kick', 'kick mud', 'kick woofy', 'kick not punchy'],
    rootCauses: [
      'Too much sub content overlapping with bass/rumble',
      'Kick reverb not EQd - low frequencies washing out',
      'FM synthesis amount too high (common with FM kicks)',
    ],
    fixes: [
      { device: 'EQ Eight', parameter: 'Low Cut', range: '50-60 Hz on rumble track', action: 'set' },
      { device: 'Utility', parameter: 'Bass Mono', range: 'below 120 Hz', action: 'set' },
      { device: 'Operator', parameter: 'FM From B', range: [0.1, 0.2], action: 'set' },
    ],
    explanation:
      'Kick and rumble fight for the same sub frequencies. Sculpt the rumble below 50-60 Hz to give the kick room. If using FM synthesis, keep modulation amount at 10-20%, not 60% (that produces woofy mud).',
  },
  {
    symptoms: ['kick disappears', 'kick lost', 'no kick punch', 'kick buried'],
    rootCauses: [
      'Over-compression smashing transients',
      'Two limiters in series destroying dynamics',
      'Kick not sidechained properly',
    ],
    fixes: [
      { device: 'Compressor', parameter: 'Attack', range: [10, 30], action: 'set' },
      { device: 'Compressor', parameter: 'Ratio', range: [2, 4], action: 'set' },
      { device: 'Limiter', parameter: 'Gain', range: 'check for multiple limiters', action: 'check' },
    ],
    explanation:
      'Two limiters break because Limiter 1 smashes transients → Limiter 2 receives already-smashed waveform → It has nothing left to work with → Combined GR reaches 10-20 dB → Kick disappears. Solution: Delete the first limiter, or use Utility (-12 dB) before a single Limiter.',
  },

  // High Frequency Issues
  {
    symptoms: ['harsh highs', 'high end harsh', 'hats too harsh', 'presence painful'],
    rootCauses: [
      'Too much energy in 2-6 kHz presence band',
      'Resonant peaks from synthesis',
      'Over-saturated high frequencies',
    ],
    fixes: [
      { device: 'EQ Eight', parameter: 'High Shelf', range: '-2 to -4 dB above 6kHz', action: 'set' },
      { device: 'EQ Eight', parameter: 'Bell at 3kHz', range: 'narrow Q, -2 to -3 dB', action: 'set' },
      { device: 'Saturator', parameter: 'Drive', range: [4, 8], action: 'check' },
    ],
    explanation:
      'Hats should sit above everything else, crisp but not harsh. If theyre painful, theres usually a resonant peak in the 2-6 kHz range. Use a narrow Q to notch it out rather than broad high-frequency reduction.',
  },
  {
    symptoms: ['midrange hole', 'hollow mids', 'missing mids', '8-12k hole'],
    rootCauses: [
      'Destructive multiband limiting',
      'Phase cancellation between elements',
      'Over-aggressive high-pass filtering',
    ],
    fixes: [
      {
        device: 'Multiband Dynamics',
        parameter: 'High Band Ratio',
        range: 'reduce to 2:1 or bypass',
        action: 'set',
      },
      { device: 'Utility', parameter: 'Phase', range: 'check for cancellation', action: 'check' },
    ],
    explanation:
      'Huge midrange holes around 8-12 kHz usually come from destructive multiband limiting or phase cancellation. Check if multiple elements are fighting in that range. Try inverting phase on one element to test for cancellation.',
  },

  // Dynamics Issues
  {
    symptoms: ['no dynamics', 'too compressed', 'flat dynamics', 'lifeless'],
    rootCauses: [
      'Compressor ratio too high',
      'Attack too fast killing transients',
      'Multiple stages of compression stacking',
    ],
    fixes: [
      { device: 'Compressor', parameter: 'Ratio', range: [2, 4], action: 'set' },
      { device: 'Compressor', parameter: 'Attack', range: [10, 50], action: 'set' },
      { device: 'Glue Compressor', parameter: 'Range', range: '-6 dB max', action: 'set' },
    ],
    explanation:
      'For techno, you want 3-6 dB crest factor (peak minus RMS). If its lower, youre over-compressed. Check each compressor in the chain - combined gain reduction shouldnt exceed 6-8 dB total.',
  },

  // Stereo/Width Issues
  {
    symptoms: ['mono collapse', 'no width', 'sounds narrow', 'stereo weak'],
    rootCauses: [
      'Too many elements in mono',
      'Reverb returns summed to mono',
      'Stereo elements phase-cancelled in mono',
    ],
    fixes: [
      { device: 'Utility', parameter: 'Width', range: [100, 150], action: 'check' },
      { device: 'Utility', parameter: 'Bass Mono', range: 'below 120 Hz', action: 'set' },
    ],
    explanation:
      "Kick & rumble should be mono. Synth + noise should be wide. If your mix collapses in mono, check your stereo elements for phase issues. Use Utility's 'Mono' button to A/B test mono compatibility.",
  },

  // Saturation/Warmth
  {
    symptoms: ['too clean', 'sterile', 'needs warmth', 'digital sounding'],
    rootCauses: [
      'No harmonic content added',
      'Over-reliance on clean digital processing',
    ],
    fixes: [
      { device: 'Saturator', parameter: 'Mode', range: 'Analog Clip', action: 'set' },
      { device: 'Saturator', parameter: 'Drive', range: [4, 8], action: 'set' },
      { device: 'Saturator', parameter: 'Soft Clip', range: 'ON', action: 'set' },
    ],
    explanation:
      'Saturator settings for techno: Analog Clip mode, Drive +4 to +8 dB, Soft Clip ON, DC Filter ON. Match output to original loudness. This adds harmonic warmth without destroying transients.',
  },

  // Reverb Issues
  {
    symptoms: ['reverb washy', 'reverb mud', 'wet mess', 'reverb cloudy'],
    rootCauses: [
      'Reverb not EQd - low frequencies building up',
      'Reverb time too long',
      'Too many elements sent to same reverb',
    ],
    fixes: [
      {
        device: 'EQ Eight',
        parameter: 'High Pass',
        range: '200-400 Hz on reverb return',
        action: 'set',
      },
      { device: 'Reverb', parameter: 'Decay Time', range: [1, 2.5], action: 'set' },
    ],
    explanation:
      'Raw kick → reverb sounds like washy mess. Proper chain: Source → Reverb → EQ (high-pass at 200-400 Hz) → maybe light compression. Always EQ your reverb returns to remove low-end buildup.',
  },
];

// Spectrum interpretation helpers
export const SPECTRUM_BANDS = {
  sub: { range: '20-60 Hz', role: 'kick fundamental, sub bass' },
  bass: { range: '60-250 Hz', role: 'kick body, bass notes' },
  lowMid: { range: '250-500 Hz', role: 'bass harmonics, warmth, potential mud' },
  mid: { range: '500-2000 Hz', role: 'body of most instruments' },
  upperMid: { range: '2000-4000 Hz', role: 'presence, intelligibility' },
  presence: { range: '4000-6000 Hz', role: 'attack, edge, potential harshness' },
  brilliance: { range: '6000-12000 Hz', role: 'air, sparkle, hi-hats' },
  air: { range: '12000-20000 Hz', role: 'shimmer, extreme highs' },
};

// Target values for techno
export const TECHNO_TARGETS = {
  masterLufs: { min: -11, max: -8, unit: 'LUFS' },
  crestFactor: { min: 3, max: 6, unit: 'dB' },
  subToBassDelta: { max: 6, unit: 'dB', note: 'sub shouldnt dominate bass by more than 6dB' },
};

export function findMatchingPatterns(symptomText: string): DiagnosticPattern[] {
  const lowerSymptom = symptomText.toLowerCase();
  return DIAGNOSTIC_PATTERNS.filter((pattern) =>
    pattern.symptoms.some((s) => lowerSymptom.includes(s))
  );
}
