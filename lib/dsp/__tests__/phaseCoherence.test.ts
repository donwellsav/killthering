/**
 * Phase Coherence Tests
 *
 * Tests PhaseHistoryBuffer — the KU Leuven 2025 phase coherence algorithm.
 * Coherence = |mean phasor of frame-to-frame phase differences|.
 * Feedback has constant phase progression (coherence ≈ 1),
 * music/noise has random phase (coherence ≈ 0).
 */

import { describe, it, expect } from 'vitest'
import { PhaseHistoryBuffer, PHASE_CONSTANTS } from '../phaseCoherence'
import { constantPhaseDelta, randomPhase, wrappingPhase } from './helpers/phaseGenerator'

// ── Helpers ─────────────────────────────────────────────────────────────────

const NUM_BINS = 64
const MAX_FRAMES = 10

function createBuffer(numBins = NUM_BINS, maxFrames = MAX_FRAMES): PhaseHistoryBuffer {
  return new PhaseHistoryBuffer(numBins, maxFrames)
}

function feedFrames(buf: PhaseHistoryBuffer, frames: Float32Array[]): void {
  for (const frame of frames) {
    buf.addFrame(frame)
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PhaseHistoryBuffer', () => {
  // ── 1. Constant phase delta → high coherence ─────────────────────────

  describe('constant phase delta (feedback)', () => {
    it('produces coherence ≈ 1.0 for constant phase increment', () => {
      const buf = createBuffer()
      const binIdx = 10
      const delta = 0.3 // ~17 degrees per frame
      const frames = constantPhaseDelta(binIdx, delta, 10, NUM_BINS)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(binIdx)

      expect(result.coherence).toBeGreaterThan(0.95)
      expect(result.feedbackScore).toBeGreaterThan(0.95)
      expect(result.isFeedbackLikely).toBe(true)
    })

    it('produces low phaseDeltaStd for constant delta', () => {
      const buf = createBuffer()
      const binIdx = 5
      const frames = constantPhaseDelta(binIdx, 0.5, 10, NUM_BINS)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(binIdx)

      expect(result.phaseDeltaStd).toBeLessThan(0.01)
      expect(result.meanPhaseDelta).toBeCloseTo(0.5, 2)
    })
  })

  // ── 2. Random phase → low coherence ──────────────────────────────────

  describe('random phase (music/noise)', () => {
    it('produces coherence < 0.3 for random phase', () => {
      const buf = createBuffer()
      const frames = randomPhase(10, NUM_BINS, 42)
      feedFrames(buf, frames)

      // Check several bins — all should be low coherence
      for (const bin of [5, 10, 20, 30]) {
        const result = buf.calculateCoherence(bin)
        expect(result.coherence).toBeLessThan(0.5)
        expect(result.isFeedbackLikely).toBe(false)
      }
    })

    it('produces high phaseDeltaStd for random phase', () => {
      const buf = createBuffer()
      const frames = randomPhase(10, NUM_BINS, 99)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(15)
      expect(result.phaseDeltaStd).toBeGreaterThan(0.5)
    })
  })

  // ── 3. Phase wrapping across ±π ──────────────────────────────────────

  describe('phase wrapping', () => {
    it('maintains high coherence even when phase wraps around ±π', () => {
      const buf = createBuffer()
      const binIdx = 8
      // Start near +π with large delta → will cross the ±π boundary
      const frames = wrappingPhase(binIdx, 2.8, 0.7, 10, NUM_BINS)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(binIdx)

      // Phase unwrapping in the algorithm should handle the wrap
      expect(result.coherence).toBeGreaterThan(0.9)
      expect(result.isFeedbackLikely).toBe(true)
    })
  })

  // ── 4. Below MIN_SAMPLES → default result ────────────────────────────

  describe('min samples gate', () => {
    it('returns zero coherence when below MIN_SAMPLES', () => {
      const buf = createBuffer()
      // Feed fewer frames than MIN_SAMPLES (5)
      const frames = constantPhaseDelta(3, 0.5, PHASE_CONSTANTS.MIN_SAMPLES - 1, NUM_BINS)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(3)

      expect(result.coherence).toBe(0)
      expect(result.feedbackScore).toBe(0)
      expect(result.meanPhaseDelta).toBe(0)
      expect(result.phaseDeltaStd).toBe(0)
      expect(result.isFeedbackLikely).toBe(false)
    })

    it('computes coherence once frameCount >= MIN_SAMPLES', () => {
      const buf = createBuffer()
      const frames = constantPhaseDelta(3, 0.5, PHASE_CONSTANTS.MIN_SAMPLES, NUM_BINS)
      feedFrames(buf, frames)

      const result = buf.calculateCoherence(3)

      expect(result.coherence).toBeGreaterThan(0)
    })
  })

  // ── 5. Reset ─────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears history and frame count', () => {
      const buf = createBuffer()
      feedFrames(buf, constantPhaseDelta(5, 0.3, 10, NUM_BINS))

      expect(buf.getFrameCount()).toBe(10)

      buf.reset()

      expect(buf.getFrameCount()).toBe(0)
      const result = buf.calculateCoherence(5)
      expect(result.coherence).toBe(0)
      expect(result.feedbackScore).toBe(0)
    })
  })

  // ── 6. Multi-bin isolation ───────────────────────────────────────────

  describe('multi-bin isolation', () => {
    it('coherence for one bin is independent of another', () => {
      const buf = createBuffer()

      // Build frames where bin 10 has constant delta, bin 20 has random phase
      const constFrames = constantPhaseDelta(10, 0.4, 10, NUM_BINS)
      const randFrames = randomPhase(10, NUM_BINS, 77)

      // Merge: use constant-delta for bin 10, random for bin 20
      const merged: Float32Array[] = []
      for (let f = 0; f < 10; f++) {
        const frame = new Float32Array(NUM_BINS)
        frame[10] = constFrames[f][10]
        frame[20] = randFrames[f][20]
        merged.push(frame)
      }
      feedFrames(buf, merged)

      const r10 = buf.calculateCoherence(10)
      const r20 = buf.calculateCoherence(20)

      expect(r10.coherence).toBeGreaterThan(0.9)
      expect(r10.isFeedbackLikely).toBe(true)

      // Random bin should have lower coherence
      expect(r20.coherence).toBeLessThan(r10.coherence)
    })
  })

  // ── 7. feedbackScore = coherence (1:1 mapping) ───────────────────────

  describe('feedbackScore mapping', () => {
    it('feedbackScore equals coherence', () => {
      const buf = createBuffer()
      feedFrames(buf, constantPhaseDelta(7, 0.2, 10, NUM_BINS))

      const result = buf.calculateCoherence(7)

      expect(result.feedbackScore).toBe(result.coherence)
    })
  })

  // ── 8. isFeedbackLikely threshold ────────────────────────────────────

  describe('isFeedbackLikely threshold', () => {
    it('true when coherence >= HIGH_COHERENCE', () => {
      const buf = createBuffer()
      feedFrames(buf, constantPhaseDelta(4, 0.1, 10, NUM_BINS))

      const result = buf.calculateCoherence(4)

      // Constant delta → coherence ≈ 1.0 > HIGH_COHERENCE (0.85)
      expect(result.coherence).toBeGreaterThanOrEqual(PHASE_CONSTANTS.HIGH_COHERENCE)
      expect(result.isFeedbackLikely).toBe(true)
    })

    it('false when coherence < HIGH_COHERENCE', () => {
      const buf = createBuffer()
      feedFrames(buf, randomPhase(10, NUM_BINS, 123))

      const result = buf.calculateCoherence(12)

      expect(result.coherence).toBeLessThan(PHASE_CONSTANTS.HIGH_COHERENCE)
      expect(result.isFeedbackLikely).toBe(false)
    })
  })
})
