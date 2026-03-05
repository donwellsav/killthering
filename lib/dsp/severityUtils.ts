// Shared severity utility — extracted from classifier.ts to prevent duplication

import type { SeverityLevel } from '@/types/advisory'

/**
 * Get urgency level (1-5) for severity
 */
export function getSeverityUrgency(severity: SeverityLevel): number {
  switch (severity) {
    case 'RUNAWAY': return 5
    case 'GROWING': return 4
    case 'RESONANCE': return 3
    case 'POSSIBLE_RING': return 2
    case 'WHISTLE': return 1
    case 'INSTRUMENT': return 1
    default: return 0
  }
}
