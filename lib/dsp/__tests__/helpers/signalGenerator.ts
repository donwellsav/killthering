/**
 * Synthetic FFT Spectrum Generator
 *
 * Creates deterministic dB-scale Float32Array outputs matching
 * AnalyserNode.getFloatFrequencyData() format:
 * - Values are in dB (negative, with -Infinity for silence)
 * - Array length = fftSize / 2 (Nyquist bins)
 * - Bin frequency = (bin * sampleRate) / fftSize
 */

/** Convert frequency to FFT bin index */
export function freqToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round(hz * fftSize / sampleRate)
}

/** Convert FFT bin to frequency */
export function binToFreq(bin: number, sampleRate: number, fftSize: number): number {
  return (bin * sampleRate) / fftSize
}

/**
 * Pure sine at a specific frequency — single bin spike above noise floor.
 * Models feedback: one dominant frequency, everything else is noise.
 */
export function pureSine(
  frequencyHz: number,
  magnitudeDb: number,
  sampleRate: number = 48000,
  fftSize: number = 8192,
  noiseFloorDb: number = -80,
): Float32Array {
  const numBins = fftSize / 2
  const spectrum = new Float32Array(numBins)
  spectrum.fill(noiseFloorDb)

  const bin = freqToBin(frequencyHz, sampleRate, fftSize)
  if (bin >= 0 && bin < numBins) {
    spectrum[bin] = magnitudeDb
  }

  return spectrum
}

/**
 * Two simultaneous sines — e.g., feedback + harmonic, or two feedback frequencies.
 */
export function twoSines(
  f1: number, f2: number,
  mag1: number, mag2: number,
  sampleRate: number = 48000,
  fftSize: number = 8192,
  noiseFloorDb: number = -80,
): Float32Array {
  const numBins = fftSize / 2
  const spectrum = new Float32Array(numBins)
  spectrum.fill(noiseFloorDb)

  const bin1 = freqToBin(f1, sampleRate, fftSize)
  const bin2 = freqToBin(f2, sampleRate, fftSize)

  if (bin1 >= 0 && bin1 < numBins) spectrum[bin1] = mag1
  if (bin2 >= 0 && bin2 < numBins) spectrum[bin2] = mag2

  return spectrum
}

/**
 * Flat noise floor — uniform dB level across all bins.
 * Models broadband noise (e.g., HVAC, audience, hiss).
 */
export function noiseFloor(levelDb: number, fftSize: number = 8192): Float32Array {
  const numBins = fftSize / 2
  const spectrum = new Float32Array(numBins)
  spectrum.fill(levelDb)
  return spectrum
}

/**
 * Linearly growing sine — magnitude ramps from startDb to endDb over numFrames.
 * Models feedback building up over time (for MSD testing).
 * Returns array of spectra, one per frame.
 */
export function growingSine(
  freqHz: number,
  startDb: number,
  endDb: number,
  numFrames: number,
  sampleRate: number = 48000,
  fftSize: number = 8192,
  noiseFloorDb: number = -80,
): Float32Array[] {
  const frames: Float32Array[] = []
  const bin = freqToBin(freqHz, sampleRate, fftSize)
  const numBins = fftSize / 2

  for (let i = 0; i < numFrames; i++) {
    const t = numFrames > 1 ? i / (numFrames - 1) : 0
    const mag = startDb + t * (endDb - startDb)
    const spectrum = new Float32Array(numBins)
    spectrum.fill(noiseFloorDb)
    if (bin >= 0 && bin < numBins) {
      spectrum[bin] = mag
    }
    frames.push(spectrum)
  }

  return frames
}

/**
 * Swept sine — frequency moves from startHz to endHz over numFrames.
 * One bin active per frame. Models non-feedback content.
 */
export function sweptSine(
  startHz: number,
  endHz: number,
  numFrames: number,
  magnitudeDb: number = -20,
  sampleRate: number = 48000,
  fftSize: number = 8192,
  noiseFloorDb: number = -80,
): Float32Array[] {
  const frames: Float32Array[] = []
  const numBins = fftSize / 2

  for (let i = 0; i < numFrames; i++) {
    const t = numFrames > 1 ? i / (numFrames - 1) : 0
    const freq = startHz + t * (endHz - startHz)
    const bin = freqToBin(freq, sampleRate, fftSize)
    const spectrum = new Float32Array(numBins)
    spectrum.fill(noiseFloorDb)
    if (bin >= 0 && bin < numBins) {
      spectrum[bin] = magnitudeDb
    }
    frames.push(spectrum)
  }

  return frames
}
