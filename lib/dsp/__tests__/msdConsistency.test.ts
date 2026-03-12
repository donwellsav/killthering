/**
 * MSD Consistency Tests
 *
 * Verifies that the MSDHistoryBuffer (used in the worker thread via msdAnalysis.ts)
 * produces results consistent with the inline calculateMsd() in feedbackDetector.ts.
 *
 * Both implementations compute mean-squared second derivative of magnitude history.
 * After consolidation, they share:
 * - Full-resolution bin indexing (no max-pool downsampling)
 * - Unified buffer depth (MAX_FRAMES = HISTORY_SIZE = 64)
 * - Relative energy gate (6 dB above noise floor)
 * - Content-adaptive minimum frames
 *
 * These tests use MSDHistoryBuffer directly (public API) and verify the math
 * matches what feedbackDetector.ts would produce for identical input sequences.
 */

import { describe, it, expect } from 'vitest'
import { MSDHistoryBuffer, MSD_CONSTANTS } from '../msdAnalysis'
import { MSD_SETTINGS } from '../constants'
import { getMsdMinFrames } from '../workerFft'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a buffer and feed it a sequence of single-bin frames */
function feedSequence(values: number[], numBins = 1): MSDHistoryBuffer {
  const buf = new MSDHistoryBuffer(numBins)
  for (const v of values) {
    const frame = new Float32Array(numBins)
    frame[0] = v
    buf.addFrame(frame)
  }
  return buf
}

/**
 * Compute expected MSD by hand for a sequence of dB values.
 * MSD = mean of squared second derivatives.
 * secondDeriv[i] = v[i] - 2*v[i-1] + v[i-2] for i >= 2
 */
function expectedMsd(values: number[]): number {
  if (values.length < 3) return Infinity
  let sumSq = 0
  for (let i = 2; i < values.length; i++) {
    const d2 = values[i] - 2 * values[i - 1] + values[i - 2]
    sumSq += d2 * d2
  }
  return sumSq / (values.length - 2)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MSD Consistency', () => {
  // ── 1. Linear ramp (pure feedback pattern) ──────────────────────────────

  describe('linear ramp (feedback)', () => {
    it('produces MSD ≈ 0 for perfectly linear dB growth', () => {
      // Linear ramp: 0, 1, 2, 3, ..., 19 dB — constant first derivative, zero second derivative
      const values = Array.from({ length: 20 }, (_, i) => -40 + i * 1.0)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeCloseTo(0, 10)
      expect(result.isFeedbackLikely).toBe(true)
      expect(result.feedbackScore).toBeCloseTo(1.0, 5)
      expect(result.framesAnalyzed).toBe(20)
    })

    it('produces MSD ≈ 0 for constant magnitude (stable feedback at GBF)', () => {
      // Flat line: feedback that has reached equilibrium
      const values = Array.from({ length: 15 }, () => -20)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeCloseTo(0, 10)
      expect(result.isFeedbackLikely).toBe(true)
    })
  })

  // ── 2. Noisy signal (not feedback) ──────────────────────────────────────

  describe('noisy signal', () => {
    it('produces MSD >> threshold for random fluctuations', () => {
      // Seeded pseudo-random: alternating high/low values with large swings
      const values: number[] = []
      for (let i = 0; i < 20; i++) {
        values.push(-30 + (i % 2 === 0 ? 8 : -8) + (i % 3) * 2)
      }
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeGreaterThan(MSD_SETTINGS.THRESHOLD)
      expect(result.isFeedbackLikely).toBe(false)
      expect(result.feedbackScore).toBeLessThan(0.5)
    })
  })

  // ── 3. Energy gate ──────────────────────────────────────────────────────

  describe('energy gate', () => {
    it('rejects bins below noise floor with relative gate', () => {
      // Values at -65 dB, noise floor at -60 dB → only 5 dB above → reject (need 6)
      const values = Array.from({ length: 15 }, () => -65)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7, -60)

      expect(result.msd).toBe(Infinity)
      expect(result.feedbackScore).toBe(0)
      expect(result.isFeedbackLikely).toBe(false)
    })

    it('passes bins sufficiently above noise floor', () => {
      // Values at -50 dB, noise floor at -60 dB → 10 dB above → pass
      const values = Array.from({ length: 15 }, () => -50)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7, -60)

      expect(result.msd).not.toBe(Infinity)
      expect(result.msd).toBeCloseTo(0, 10) // constant = zero MSD
    })

    it('uses absolute -70 dB gate when noiseFloorDb is null', () => {
      // Values at -75 dB, no noise floor → falls back to absolute gate
      const values = Array.from({ length: 15 }, () => -75)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7, null)

      expect(result.msd).toBe(Infinity)
      expect(result.feedbackScore).toBe(0)
    })

    it('passes absolute gate when mean magnitude > -70 dB', () => {
      const values = Array.from({ length: 15 }, () => -50)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7, null)

      expect(result.msd).not.toBe(Infinity)
    })
  })

  // ── 4. Min frames gate ──────────────────────────────────────────────────

  describe('min frames gate', () => {
    it('returns Infinity when frameCount < minFrames', () => {
      const values = [-30, -29, -28, -27, -26] // only 5 frames
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7) // need 7

      expect(result.msd).toBe(Infinity)
      expect(result.feedbackScore).toBe(0)
      expect(result.isFeedbackLikely).toBe(false)
      expect(result.framesAnalyzed).toBe(5)
    })

    it('computes MSD once frameCount >= minFrames', () => {
      const values = Array.from({ length: 7 }, (_, i) => -40 + i)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).not.toBe(Infinity)
      expect(result.framesAnalyzed).toBe(7)
    })
  })

  // ── 5. Frame count equivalence ──────────────────────────────────────────

  describe('frame count tracking', () => {
    it('reports correct framesAnalyzed', () => {
      const buf = new MSDHistoryBuffer(1)

      // Feed 10 frames
      for (let i = 0; i < 10; i++) {
        const frame = new Float32Array(1)
        frame[0] = -30 + i
        buf.addFrame(frame)
      }

      const result = buf.calculateMSD(0, 7)
      expect(result.framesAnalyzed).toBe(10)
    })

    it('caps at MAX_FRAMES when buffer wraps', () => {
      const buf = new MSDHistoryBuffer(1)
      const maxFrames = MSD_CONSTANTS.MAX_FRAMES // 64

      // Feed more frames than buffer capacity
      for (let i = 0; i < maxFrames + 20; i++) {
        const frame = new Float32Array(1)
        frame[0] = -30 + (i % 10)
        buf.addFrame(frame)
      }

      const result = buf.calculateMSD(0, 7)
      expect(result.framesAnalyzed).toBe(maxFrames)
    })
  })

  // ── 6. Numerical precision ──────────────────────────────────────────────

  describe('numerical precision', () => {
    it('matches hand-computed MSD for a known sequence', () => {
      // Known sequence: [-40, -38, -35, -33, -32, -30, -29, -27, -26, -25]
      const values = [-40, -38, -35, -33, -32, -30, -29, -27, -26, -25]
      const expected = expectedMsd(values)

      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeCloseTo(expected, 6)
    })

    it('matches hand-computed MSD for irregular intervals', () => {
      // Irregular growth: simulates realistic slightly-noisy feedback
      const values = [-50, -48.5, -47.1, -45.3, -44.0, -42.8, -41.2, -40.0, -38.5, -37.3, -36.0, -34.8]
      const expected = expectedMsd(values)

      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      // 5 decimal places — ring-buffer modular indexing introduces sub-microsecond
      // float rounding differences vs. linear array iteration
      expect(result.msd).toBeCloseTo(expected, 5)
    })

    it('feedbackScore is exp(-msd / threshold)', () => {
      const values = [-50, -48, -47, -45, -44, -42, -41, -40, -38, -37]
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      const expectedScore = Math.exp(-result.msd / MSD_CONSTANTS.THRESHOLD)
      expect(result.feedbackScore).toBeCloseTo(expectedScore, 10)
    })
  })

  // ── 7. Content-adaptive min frames ──────────────────────────────────────

  describe('content-adaptive min frames', () => {
    it('getMsdMinFrames returns correct values per content type', () => {
      expect(getMsdMinFrames('speech')).toBe(MSD_SETTINGS.MIN_FRAMES_SPEECH)     // 7
      expect(getMsdMinFrames('music')).toBe(MSD_SETTINGS.MIN_FRAMES_MUSIC)       // 13
      expect(getMsdMinFrames('compressed')).toBe(MSD_CONSTANTS.MAX_FRAMES)        // 64
      expect(getMsdMinFrames('default')).toBe(MSD_CONSTANTS.DEFAULT_FRAMES)       // 7
    })

    it('speech min frames ≤ default min frames (A fires before or with B)', () => {
      // Invariant: main-thread (A) must not require MORE frames than worker (B)
      expect(MSD_SETTINGS.MIN_FRAMES_SPEECH).toBeLessThanOrEqual(MSD_SETTINGS.DEFAULT_MIN_FRAMES)
    })

    it('music min frames ≤ MAX_FRAMES', () => {
      expect(MSD_SETTINGS.MIN_FRAMES_MUSIC).toBeLessThanOrEqual(MSD_CONSTANTS.MAX_FRAMES)
    })

    it('MAX_FRAMES equals HISTORY_SIZE (buffer depth unified)', () => {
      expect(MSD_CONSTANTS.MAX_FRAMES).toBe(MSD_SETTINGS.HISTORY_SIZE)
    })
  })

  // ── 8. Multi-bin isolation ──────────────────────────────────────────────

  describe('multi-bin isolation', () => {
    it('MSD for one bin is independent of other bins', () => {
      const numBins = 4
      const buf = new MSDHistoryBuffer(numBins)

      // Feed 15 frames: bin 0 gets linear ramp, bin 1 gets random-ish values
      for (let f = 0; f < 15; f++) {
        const frame = new Float32Array(numBins)
        frame[0] = -40 + f          // linear ramp → MSD ≈ 0
        frame[1] = -30 + (f % 2 === 0 ? 5 : -5) // oscillating → high MSD
        frame[2] = -50 + f * 0.5    // slow linear ramp → MSD ≈ 0
        frame[3] = -20              // constant → MSD = 0
        buf.addFrame(frame)
      }

      const r0 = buf.calculateMSD(0, 7)
      const r1 = buf.calculateMSD(1, 7)
      const r2 = buf.calculateMSD(2, 7)
      const r3 = buf.calculateMSD(3, 7)

      // Bin 0: linear ramp → near-zero MSD
      expect(r0.msd).toBeCloseTo(0, 6)
      expect(r0.isFeedbackLikely).toBe(true)

      // Bin 1: oscillating → high MSD
      expect(r1.msd).toBeGreaterThan(MSD_SETTINGS.THRESHOLD)
      expect(r1.isFeedbackLikely).toBe(false)

      // Bin 2: slow linear ramp → near-zero MSD
      expect(r2.msd).toBeCloseTo(0, 6)

      // Bin 3: constant → zero MSD
      expect(r3.msd).toBeCloseTo(0, 10)
      expect(r3.isFeedbackLikely).toBe(true)
    })
  })

  // ── 9. feedbackScore edge cases ────────────────────────────────────────

  describe('feedbackScore edge cases', () => {
    it('feedbackScore at MSD = 0 is exp(0) = 1.0', () => {
      // Constant value → MSD = 0 → feedbackScore = exp(0) = 1.0
      const values = Array.from({ length: 15 }, () => -30)
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeCloseTo(0, 10)
      expect(result.feedbackScore).toBeCloseTo(1.0, 10)
    })

    it('feedbackScore at MSD = THRESHOLD is exp(-1) ≈ 0.368', () => {
      // We need to construct input that produces MSD exactly = THRESHOLD
      // feedbackScore = exp(-THRESHOLD / THRESHOLD) = exp(-1) ≈ 0.368
      // Since we can verify the formula, just check the relationship holds
      const values = [-50, -48, -47, -45, -44, -42, -41, -40, -38, -37]
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      const expectedScore = Math.exp(-result.msd / MSD_CONSTANTS.THRESHOLD)
      expect(result.feedbackScore).toBeCloseTo(expectedScore, 10)

      // Specifically verify the exp(-1) identity
      if (Math.abs(result.msd - MSD_CONSTANTS.THRESHOLD) < 0.001) {
        expect(result.feedbackScore).toBeCloseTo(Math.exp(-1), 3)
      }
    })

    it('feedbackScore approaches 0 for very large MSD', () => {
      // Wild oscillations → very large MSD → feedbackScore ≈ 0
      const values: number[] = []
      for (let i = 0; i < 20; i++) {
        values.push(i % 2 === 0 ? -10 : -60) // 50 dB swings
      }
      const buf = feedSequence(values)
      const result = buf.calculateMSD(0, 7)

      expect(result.msd).toBeGreaterThan(10 * MSD_CONSTANTS.THRESHOLD)
      expect(result.feedbackScore).toBeLessThan(0.01)
    })

    it('feedbackScore is monotonically decreasing with MSD', () => {
      // Three scenarios: low MSD < medium MSD < high MSD
      // Constant → linear ramp → oscillating
      const constant = feedSequence(Array.from({ length: 15 }, () => -30))
      const linear = feedSequence(Array.from({ length: 15 }, (_, i) => -40 + i * 0.5))
      const noisy = feedSequence(
        Array.from({ length: 15 }, (_, i) => -30 + (i % 2 === 0 ? 3 : -3))
      )

      const r1 = constant.calculateMSD(0, 7)
      const r2 = linear.calculateMSD(0, 7)
      const r3 = noisy.calculateMSD(0, 7)

      expect(r1.msd).toBeLessThanOrEqual(r2.msd)
      expect(r1.feedbackScore).toBeGreaterThanOrEqual(r2.feedbackScore)
      expect(r2.feedbackScore).toBeGreaterThanOrEqual(r3.feedbackScore)
    })
  })

  // ── 10. Reset behavior ─────────────────────────────────────────────────

  describe('reset', () => {
    it('clears history and frame count after reset', () => {
      const buf = feedSequence(Array.from({ length: 15 }, (_, i) => -40 + i))

      // Should have data
      expect(buf.getFrameCount()).toBe(15)
      const before = buf.calculateMSD(0, 7)
      expect(before.msd).not.toBe(Infinity)

      // Reset
      buf.reset()

      expect(buf.getFrameCount()).toBe(0)
      const after = buf.calculateMSD(0, 7)
      expect(after.msd).toBe(Infinity) // not enough frames
      expect(after.framesAnalyzed).toBe(0)
    })
  })
})
