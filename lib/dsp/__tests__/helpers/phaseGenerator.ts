/**
 * Phase Data Generator
 *
 * Creates deterministic phase data (radians) for PhaseHistoryBuffer testing.
 * Each frame is a Float32Array of phase angles per bin, matching what
 * you'd extract from time-domain samples via atan2(imag, real).
 */

/**
 * Constant phase delta — phase advances by deltaRadians per frame at binIndex.
 * This models feedback: a pure tone produces a fixed phase increment per hop.
 * All other bins get zero phase.
 */
export function constantPhaseDelta(
  binIndex: number,
  deltaRadians: number,
  numFrames: number,
  numBins: number,
): Float32Array[] {
  const frames: Float32Array[] = []

  for (let f = 0; f < numFrames; f++) {
    const frame = new Float32Array(numBins)
    // Phase accumulates linearly: φ(f) = f * delta
    frame[binIndex] = f * deltaRadians
    frames.push(frame)
  }

  return frames
}

/**
 * Random phase per frame — no phase consistency between frames.
 * This models music/noise: phase is unpredictable.
 * Uses a simple deterministic pseudo-random (mulberry32) for reproducibility.
 */
export function randomPhase(
  numFrames: number,
  numBins: number,
  seed: number = 42,
): Float32Array[] {
  const frames: Float32Array[] = []
  let state = seed

  // mulberry32 PRNG — deterministic, fast
  function rand(): number {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let f = 0; f < numFrames; f++) {
    const frame = new Float32Array(numBins)
    for (let b = 0; b < numBins; b++) {
      // Random phase in [-π, π]
      frame[b] = (rand() * 2 - 1) * Math.PI
    }
    frames.push(frame)
  }

  return frames
}

/**
 * Wrapping phase — phase accumulates and wraps across the ±π boundary.
 * Tests that the coherence algorithm correctly unwraps phase differences.
 * All other bins get zero phase.
 */
export function wrappingPhase(
  binIndex: number,
  startRadians: number,
  deltaPerFrame: number,
  numFrames: number,
  numBins: number,
): Float32Array[] {
  const frames: Float32Array[] = []

  for (let f = 0; f < numFrames; f++) {
    const frame = new Float32Array(numBins)
    // Raw accumulation — will exceed ±π, testing unwrap logic
    frame[binIndex] = startRadians + f * deltaPerFrame
    frames.push(frame)
  }

  return frames
}
