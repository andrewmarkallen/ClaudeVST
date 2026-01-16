#!/usr/bin/env node
/**
 * CLI for standalone reference track analysis
 * Runs without Ableton - just analyzes and outputs human-readable results
 */
import { AnalysisService } from './analysis-service.js';
import path from 'path';
const analysisService = new AnalysisService();
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function formatDuration(seconds) {
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${Math.round(seconds)}s`;
}
function printTable(rows, headers) {
    // Calculate column widths
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || '').length)));
    const separator = '├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
    const top = '┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
    const bottom = '└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
    const formatRow = (row) => '│' + row.map((cell, i) => ` ${(cell || '').padEnd(widths[i])} `).join('│') + '│';
    console.log(top);
    console.log(formatRow(headers));
    console.log(separator);
    rows.forEach(row => console.log(formatRow(row)));
    console.log(bottom);
}
async function analyze(audioPath) {
    const absolutePath = path.resolve(audioPath);
    const filename = path.basename(audioPath);
    console.log('\nReference Track Analysis');
    console.log('========================');
    console.log(`File: ${filename}`);
    console.log('Analyzing... (this may take 1-3 minutes)\n');
    try {
        const result = await analysisService.analyzeTrack(absolutePath);
        console.log(`Duration: ${formatTime(result.duration_seconds)} (${Math.round(result.duration_seconds)}s)`);
        console.log(`Tempo: ${result.tempo_bpm.toFixed(1)} BPM`);
        console.log();
        // Show all hierarchy levels
        const levelNames = ['Coarse', 'Medium', 'Fine'];
        for (const hierarchyLevel of result.levels) {
            const levelName = levelNames[hierarchyLevel.level] || `Level ${hierarchyLevel.level}`;
            console.log(`Structure (${levelName}):`);
            const rows = hierarchyLevel.segments.map(seg => [
                formatTime(seg.start),
                formatTime(seg.end),
                seg.label + (seg.is_transition ? ' (trans)' : ''),
                formatDuration(seg.end - seg.start),
            ]);
            printTable(rows, ['Start', 'End', 'Label', 'Duration']);
            console.log();
        }
    }
    catch (error) {
        console.error('Analysis failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run analyze -- <audio-file>

Analyze a reference track and display structure.

Options:
  -h, --help     Show this help message

Examples:
  npm run analyze -- track.wav
  npm run analyze -- /path/to/song.mp3

Supported formats: WAV, AIFF, MP3, FLAC, M4A
`);
    process.exit(0);
}
const audioPath = args[0];
analyze(audioPath);
//# sourceMappingURL=cli.js.map