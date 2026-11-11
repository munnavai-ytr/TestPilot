import { Bug } from './types';

/**
 * Calculates QA quality score by code:
 * Starts at 100:
 * - Critical: -25
 * - High: -15
 * - Medium: -8
 * - Low: -3
 * Clamped between 0 and 100.
 */
export function calculateScore(bugs: Bug[]): number {
  let score = 100;

  for (const bug of bugs) {
    const sev = (bug.severity || 'low').toLowerCase();
    switch (sev) {
      case 'critical':
        score -= 25;
        break;
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
      default:
        score -= 3;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}
