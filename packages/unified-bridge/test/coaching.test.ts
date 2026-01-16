import { describe, it, expect } from 'vitest';
import { findMatchingPatterns, DIAGNOSTIC_PATTERNS } from '../src/coaching/knowledge-base';

describe('Coaching Knowledge Base', () => {
  describe('findMatchingPatterns', () => {
    it('finds kick mud patterns', () => {
      // Symptom text must contain the exact phrase 'muddy kick' or 'kick mud'
      const patterns = findMatchingPatterns('my kick is muddy kick sound');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].symptoms).toContain('muddy kick');
    });

    it('finds harsh highs patterns', () => {
      // Symptom keywords include 'harsh highs'
      const patterns = findMatchingPatterns('I have harsh highs in my mix');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].symptoms.some(s => s.includes('harsh'))).toBe(true);
    });

    it('finds compression patterns', () => {
      // Symptom keywords include 'lifeless' as a standalone term
      const patterns = findMatchingPatterns('mix sounds lifeless');
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('returns empty for unknown symptoms', () => {
      const patterns = findMatchingPatterns('the purple sounds too yellow');
      expect(patterns.length).toBe(0);
    });
  });

  describe('DIAGNOSTIC_PATTERNS', () => {
    it('all patterns have required fields', () => {
      DIAGNOSTIC_PATTERNS.forEach(pattern => {
        expect(pattern.symptoms.length).toBeGreaterThan(0);
        expect(pattern.rootCauses.length).toBeGreaterThan(0);
        expect(pattern.fixes.length).toBeGreaterThan(0);
        expect(pattern.explanation).toBeTruthy();
      });
    });

    it('all fixes have valid structure', () => {
      DIAGNOSTIC_PATTERNS.forEach(pattern => {
        pattern.fixes.forEach(fix => {
          expect(fix.device).toBeTruthy();
          expect(fix.parameter).toBeTruthy();
          expect(fix.range).toBeDefined();
          expect(['set', 'reduce', 'increase', 'check']).toContain(fix.action);
        });
      });
    });
  });
});
