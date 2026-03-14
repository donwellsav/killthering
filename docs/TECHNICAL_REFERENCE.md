# Kill The Ring — Technical Reference

> **Audience:** Developers, contributors, and technical users
> **Version:** 1.0 | **Date:** 2026-03-14 | **App Version:** 0.95.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [DSP Algorithm Reference](#2-dsp-algorithm-reference)
3. [Component & Hook API Reference](#3-component--hook-api-reference)
4. [Configuration Guide](#4-configuration-guide)
5. [Deployment Guide](#5-deployment-guide)
6. [Contributing Guide](#6-contributing-guide)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Architecture Overview

### 1.1 System Architecture

Kill The Ring is a client-side Progressive Web App that processes audio in the browser. The architecture separates concerns across three execution contexts:

```
┌─ Main Thread ──────────────────────────────────────────────────┐
│                                                                 │
│  ┌─ Web Audio Pipeline ──────────────────────────────────────┐  │
│  │  Mic → MediaStream → GainNode → AnalyserNode → FFT data  │  │
│  └───────────────────────────────────────┬───────────────────┘  │
│                                          │                       │
│  ┌─ FeedbackDetector ───────────────────┐│                       │
│  │  - A-weighting + mic calibration     ││                       │
│  │  - dB→power via precomputed LUT      ││                       │
│  │  - Prefix sum for fast local median  ││                       │
│  │  - Peak detection + persistence      ││                       │
│  │  - MSD ring buffer updates           ││                       │
│  └──────────────────────┬───────────────┘│                       │
│                         │ postMessage     │                       │
│  ┌─ React UI ──────────┐│(transferable)  │                       │
│  │  3 Contexts:        ││               │                       │
│  │  - AudioAnalyzer    ││               │                       │
│  │  - Advisory         ││               │                       │
│  │  - UI               ││               │                       │
│  │                     ││               │                       │
│  │  Canvas rendering   ││               │                       │
│  │  (60fps rAF loop)   ││               │                       │
│  └─────────────────────┘│               │                       │
│                         │               │                       │
└─────────────────────────┼───────────────┼───────────────────────┘
                          │               │
┌─ Web Worker ────────────▼───────────────┘───────────────────────┐
│                                                                  │
│  ┌─ dspWorker.ts (orchestrator) ──────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌─ AlgorithmEngine ──────┐  ┌─ AdvisoryManager ────────┐  │  │
│  │  │  - workerFft.ts        │  │  - Create/update/clear    │  │  │
│  │  │  - MSD analysis        │  │  - Deduplication          │  │  │
│  │  │  - Phase coherence     │  │  - Pruning                │  │  │
│  │  │  - Amplitude history   │  │  - Frequency proximity    │  │  │
│  │  └────────────────────────┘  └───────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─ TrackManager ─────────┐  ┌─ DecayAnalyzer ──────────┐  │  │
│  │  │  - Track lifecycle     │  │  - Room mode decay        │  │  │
│  │  │  - Feature extraction  │  │  - Recent decays tracking │  │  │
│  │  └────────────────────────┘  └───────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─ Classification Pipeline ───────────────────────────────│  │
│  │  │  classifyTrack → fuseAlgorithms → generateEQ → advisory │  │
│  │  └─────────────────────────────────────────────────────────│  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ Service Worker (Serwist) ───────────────────────────────────────┐
│  - Precache manifest                                             │
│  - Runtime caching (HTTP GET/POST)                               │
│  - Offline fallback (/~offline)                                  │
│  - Navigation preload                                            │
│  - Skip waiting on user acceptance                               │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Summary

1. **Microphone input** → `AudioContext.getUserMedia()` → `MediaStreamAudioSourceNode`
2. **Signal chain** → `GainNode` (software gain/auto-gain) → `AnalyserNode` (FFT)
3. **FFT extraction** → `getFloatFrequencyData()` (dB values) + `getFloatTimeDomainData()` (waveform)
4. **Peak detection** → `FeedbackDetector.analyze()` on main thread (~25-60 Hz)
5. **Worker processing** → peaks + spectrum sent via `postMessage` (transferable buffers)
6. **Classification** → 7-algorithm fusion → verdict + EQ recommendation
7. **Advisory generation** → `AdvisoryManager` creates/updates/clears advisories
8. **UI update** → worker `postMessage` → React context state → canvas render

### 1.3 Context Architecture

```
<AudioAnalyzerProvider>          ← Engine state, settings, devices, spectrum
  <AdvisoryProvider>             ← Advisory state, dismiss/clear actions
    <UIProvider>                 ← Mobile tab, freeze, fullscreen, layout
      <PortalContainerProvider>  ← Portal mount point for mobile overlays
        <KillTheRing />          ← Root component
      </PortalContainerProvider>
    </UIProvider>
  </AdvisoryProvider>
</AudioAnalyzerProvider>
```

---

## 2. DSP Algorithm Reference

### 2.1 Algorithm Fusion Engine

Kill The Ring uses a weighted fusion of 7 independent detection algorithms:

#### MSD (Magnitude Slope Deviation) — DAFx-16
- **What it measures:** Frame-to-frame consistency of a peak's magnitude slope
- **How:** Maintains a ring buffer of magnitude slopes per frequency bin. Computes standard deviation. Feedback has low MSD (consistent growth/stability). Music has high MSD (varying dynamics).
- **Key parameters:** Ring buffer size adapts by content type (speech: 7 frames, music: 13, compressed: 64)
- **Implementation:** `lib/dsp/msdAnalysis.ts`

#### Phase Coherence — KU Leuven 2025
- **What it measures:** Consistency of phase differences between consecutive FFT frames
- **How:** Computes phase delta (Δφ) between frames. Feedback produces constant Δφ (phase-locked tone). Music/noise produces random Δφ. Uses Rayleigh test for circular uniformity.
- **Key parameters:** Min 5 samples before producing a result. Phase wrapping handled via circular arithmetic.
- **Implementation:** `lib/dsp/phaseCoherence.ts`

#### Spectral Flatness (Wiener Entropy)
- **What it measures:** How "tone-like" vs "noise-like" the spectrum is around a peak
- **How:** `flatness = geometric_mean(power) / arithmetic_mean(power)`. Pure tone → 0. White noise → 1.
- **Implementation:** `lib/dsp/compressionDetection.ts`

#### Comb Pattern Detection — DBX Paper
- **What it measures:** Evenly-spaced harmonic peaks indicating acoustic path length
- **How:** Analyzes inter-peak frequency spacing. Feedback from a single mic-speaker path produces harmonics at `f_n = n × c/d` where d is path length. Estimates path length: `d = c / Δf`.
- **Implementation:** `lib/dsp/algorithmFusion.ts` → `detectCombPattern()`

#### Inter-Harmonic Ratio (IHR)
- **What it measures:** Ratio of energy between harmonics vs at harmonics
- **How:** Low IHR = clean harmonic structure (feedback). High IHR = noisy between harmonics (music with rich timbre).
- **Implementation:** `lib/dsp/algorithmFusion.ts` → `analyzeInterHarmonicRatio()`

#### Peak-to-Median Ratio (PTMR)
- **What it measures:** How much a spectral peak stands out from the median spectrum level
- **How:** `PTMR = peak_dB - median_dB`. High PTMR = narrow isolated peak (feedback). Low PTMR = broad energy (music).
- **Implementation:** `lib/dsp/algorithmFusion.ts` → `calculatePTMR()`

#### Compression Detection
- **What it measures:** Whether the audio signal is dynamically compressed
- **How:** Tracks crest factor (peak-to-RMS ratio) and spectral flatness over time. Compressed audio has low crest factor and higher spectral flatness. Adjusts all other algorithm thresholds when compression detected.
- **Implementation:** `lib/dsp/compressionDetection.ts`

### 2.2 Fusion Verdict System

The fusion engine produces one of four verdicts:

| Verdict | Meaning | Typical Score Range |
|---------|---------|-------------------|
| `FEEDBACK` | High confidence this is acoustic feedback | probability > 0.7, confidence > 0.6 |
| `POSSIBLE_FEEDBACK` | Likely feedback but below full confidence | probability 0.4-0.7 |
| `NOT_FEEDBACK` | This is music, speech, or noise — not feedback | probability < 0.3 |
| `UNCERTAIN` | Insufficient data or conflicting algorithm signals | low confidence |

### 2.3 EQ Advisor

The EQ advisor translates feedback detections into actionable recommendations:

#### GEQ Recommendation
- Snaps detected frequency to nearest ISO 31-band center frequency
- Reports which 1/3-octave band to cut

#### PEQ Recommendation
- Uses the true (quadratic-interpolated) frequency
- Calculates cut depth using MINDS (MSD-Inspired Notch Depth Setting) when MSD data is available, or ERB-scaled depth otherwise
- Calculates Q factor from the detected -3dB bandwidth
- Frequency-dependent depth scaling via ERB psychoacoustics:
  - Below 500 Hz: 0.7× depth (protect warmth)
  - 500-2000 Hz: 1.0× depth (speech range)
  - Above 2000 Hz: 1.2× depth (more transparent at high frequencies)

#### Shelf Recommendation
- Generated for very low or very high frequency detections
- High shelf if frequency > 6 kHz, low shelf if frequency < 100 Hz

#### Pitch Translation
- Converts Hz to musical note name + octave + cents deviation
- Example: "2,512 Hz → D#5 +12¢"
- Uses A4 = 440 Hz reference

### 2.4 Acoustic Modeling

The classifier incorporates room acoustics:

- **Schroeder frequency** — `f_S = 2000 × √(T/V)` — below this, individual room modes dominate
- **Modal overlap** — `M = 1/Q` — isolated (M<0.03), coupled (M≈0.1), diffuse (M>0.33)
- **Cumulative growth** — tracks dB growth over time (WARNING at 3dB, ALERT at 6dB, RUNAWAY at 10dB)
- **Vibrato detection** — 4-8 Hz modulation rate, 20-100 cents depth → rejects vocal vibrato
- **Air absorption correction** — adjusts RT60 at high frequencies
- **Room mode proximity penalty** — reduces confidence for detections near calculated room modes

---

## 3. Component & Hook API Reference

### 3.1 Key Hooks

#### `useAudioAnalyzer`
The core hook managing the `FeedbackDetector` lifecycle.

**Returns:**
```typescript
{
  isRunning: boolean
  isStarting: boolean
  error: string | null
  start: () => Promise<void>         // Request mic, start analysis
  stop: () => void                    // Stop analysis, release mic
  switchDevice: (id: string) => Promise<void>
  settings: DetectorSettings
  updateSettings: (s: Partial<DetectorSettings>) => void
  resetSettings: () => void
  spectrumRef: RefObject<SpectrumData | null>  // Current spectrum (60fps)
  tracksRef: RefObject<TrackedPeak[]>           // Current tracked peaks
  spectrumStatus: SpectrumStatus | null
  noiseFloorDb: number | null
  sampleRate: number
  fftSize: number
  inputLevel: number                  // Current input level (dBFS)
  isAutoGain: boolean
  autoGainDb: number | undefined
}
```

#### `useDSPWorker`
Manages the Web Worker lifecycle and message passing.

**Returns:**
```typescript
{
  workerRef: RefObject<Worker | null>
  isReady: boolean
  error: string | null
  sendMessage: (msg: WorkerInboundMessage) => void
  onMessage: (handler: (msg: WorkerOutboundMessage) => void) => void
}
```

#### `useAdvisoryMap`
Manages advisory state as a `Map<string, Advisory>`.

**Returns:**
```typescript
{
  advisories: Map<string, Advisory>
  addOrUpdate: (advisory: Advisory) => void
  replace: (oldId: string, advisory: Advisory) => void
  clear: (id: string) => void
  clearAll: () => void
  markFalsePositive: (id: string) => void
  getActive: () => Advisory[]          // Sorted by severity
  count: number
}
```

### 3.2 Key Components

#### `KillTheRing`
Root orchestrator. Wraps all providers and renders either `DesktopLayout` or `MobileLayout` based on viewport.

#### `SpectrumCanvas`
HTML5 Canvas visualization of the FFT spectrum. Renders at 60fps via `requestAnimationFrame`. Draws:
- Spectrum bars (frequency × amplitude)
- GEQ overlay bands
- Advisory markers (arrows at detected frequencies)
- Noise floor line
- Threshold line

#### `IssuesList`
Displays active advisories as cards with:
- Frequency (Hz and musical note)
- Severity badge (color-coded)
- EQ recommendation (GEQ band, PEQ params)
- Dismiss / false positive actions

---

## 4. Configuration Guide

### 4.1 Operation Modes

| Mode | Target Use Case | Key Adjustments |
|------|----------------|-----------------|
| `speech` | Conferences, presentations | Faster detection, focused on speech frequencies (200-4000 Hz) |
| `worship` | Church worship services | Balanced for vocals + instruments, moderate sensitivity |
| `liveMusic` | Concerts, bands | Higher threshold to reduce false positives from loud instruments |
| `theater` | Theater, drama | Sensitive detection, wide frequency range |
| `monitors` | Stage monitor mixing | Aggressive detection, fast response |
| `ringOut` | System ring-out/calibration | Maximum sensitivity, guided workflow |
| `broadcast` | Broadcast/streaming | Conservative detection, minimize false alarms |
| `outdoor` | Outdoor events | Adjusted for open-air acoustics (no room modes) |

### 4.2 Key Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `fftSize` | 8192 | 4096/8192/16384 | FFT resolution (higher = better freq resolution, more latency) |
| `analysisIntervalMs` | 20 | 20-100 | Time between analyses (lower = more responsive, more CPU) |
| `thresholdDb` | -60 | -100 to 0 | Minimum amplitude to consider a peak |
| `prominenceDb` | 6 | 3-20 | How much a peak must stand above local median |
| `sustainMs` | 200 | 50-1000 | How long a peak must persist before reporting |
| `aWeightingEnabled` | true | bool | Apply IEC 1672 A-weighting frequency curve |
| `micCalibrationEnabled` | false | bool | Apply ECM8000 frequency response correction |
| `autoGainEnabled` | true | bool | Auto-adjust software gain for optimal detection |
| `preset` | 'surgical' | surgical/heavy | 'surgical' = narrow precise notches, 'heavy' = aggressive cuts |

### 4.3 Environment Variables

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | No | (empty) | Sentry DSN for error reporting |
| `SENTRY_AUTH_TOKEN` | No | (empty) | Sentry auth for source map upload |
| `SENTRY_ORG` | No | (empty) | Sentry organization slug |
| `SENTRY_PROJECT` | No | (empty) | Sentry project slug |
| `SUPABASE_INGEST_URL` | No | (empty) | Supabase Edge Function URL for data ingest |
| `SUPABASE_SERVICE_ROLE_KEY` | No | (empty) | Supabase service key for ingest auth |

**Note:** The app is fully functional with zero env vars. All features work client-side with localStorage persistence.

---

## 5. Deployment Guide

### 5.1 Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Vercel auto-detects Next.js and configures build settings
3. Set environment variables in Vercel dashboard (optional — Sentry, Supabase)
4. Push to `main` → auto-deploy
5. Version commits with `[skip ci]` are handled by auto-version workflows

### 5.2 Self-Hosting

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Type-check
npx tsc --noEmit

# Run tests
pnpm test

# Build production
pnpm build

# Start server
pnpm start     # Default: http://localhost:3000
```

**Requirements:**
- Node.js 22 LTS
- pnpm 10.30.1+
- HTTPS recommended (microphone API requires secure context in most browsers)

### 5.3 PWA Installation

The app is installable as a PWA:
- **Desktop Chrome/Edge:** Click install icon in address bar
- **Mobile Safari:** Share → Add to Home Screen
- **Mobile Chrome:** Install banner appears automatically

The service worker (`app/sw.ts`) handles:
- Precaching of all static assets
- Runtime caching of API responses
- Offline fallback page (`/~offline`)
- Navigation preload for fast page loads

---

## 6. Contributing Guide

### 6.1 Development Setup

```bash
git clone https://github.com/donwellsav/killthering.git
cd killthering
pnpm install
pnpm dev              # http://localhost:3000
```

### 6.2 Code Style Requirements

1. **TypeScript strict mode** — no `any`, no `@ts-ignore`
2. **Components** — PascalCase, wrapped in `memo()`, `'use client'` when needed
3. **Constants** — SCREAMING_SNAKE in `lib/dsp/constants.ts`
4. **Imports** — `@/*` path alias only
5. **Canvas** — pure functions in `lib/canvas/`, `{ current: T }` params
6. **Testing** — Vitest, academic references, edge cases

### 6.3 Pre-PR Checklist

```bash
npx tsc --noEmit      # Must pass — no type errors
pnpm lint             # Must pass — no ESLint errors
pnpm test             # Must pass — all 326+ tests green
pnpm build            # Must succeed — production build completes
```

### 6.4 Adding a New DSP Algorithm

1. Create module: `lib/dsp/myAlgorithm.ts`
   - Export result interface: `MyAlgorithmResult`
   - Export constants to `lib/dsp/constants.ts`
   - Follow ring buffer pattern from `msdAnalysis.ts`

2. Integrate into fusion: `lib/dsp/algorithmFusion.ts`
   - Add to `AlgorithmScores` interface
   - Add weight to `FusionConfig`
   - Add to `fuseAlgorithmResults()` weighted sum

3. Connect to worker: `lib/dsp/workerFft.ts`
   - Call algorithm in `processFrame()`
   - Return result in processed data

4. Add tests: `lib/dsp/__tests__/myAlgorithm.test.ts`
   - Test with synthetic data covering: pure tones (feedback-like), music-like signals, noise, edge cases
   - Reference academic paper if applicable
   - Target 80%+ coverage

5. Add integration tests: `tests/dsp/myAlgorithm.test.ts`
   - Test fusion behavior with new algorithm
   - Verify no regression on existing scenarios

### 6.5 Adding a New UI Component

1. Create: `components/kill-the-ring/MyComponent.tsx`
   ```tsx
   'use client'
   import { memo } from 'react'
   import { cn } from '@/lib/utils'

   interface MyComponentProps { /* ... */ }

   export const MyComponent = memo(function MyComponent({ ...props }: MyComponentProps) {
     return (/* ... */)
   })
   ```

2. Export from barrel: `components/kill-the-ring/index.ts`
   ```ts
   export { MyComponent } from './MyComponent'
   ```

3. Follow:
   - shadcn/ui primitives from `@/components/ui/`
   - `cn()` for conditional Tailwind classes
   - Touch targets ≥ 44×44px
   - `role="status"` + sr-only for dynamic announcements

---

## 7. Troubleshooting

### 7.1 Common Issues

#### "Microphone access denied"
- Ensure HTTPS (or localhost for development)
- Check browser permissions (Settings → Privacy → Microphone)
- Some browsers block mic access in iframes
- On mobile, check OS-level microphone permissions

#### "No audio detected" (spectrum is flat)
- Check input device selection (dropdown in header)
- Verify microphone is not muted at OS level
- Try toggling auto-gain off and adjusting manually
- Check if another app is using the microphone exclusively

#### "High CPU usage"
- Reduce `fftSize` from 16384 to 8192 or 4096
- Increase `analysisIntervalMs` from 20 to 40
- On mobile, the app automatically uses 40ms interval (25fps)
- Close other browser tabs

#### "False positives on music"
- Switch operation mode to `liveMusic` (higher thresholds)
- Increase `prominenceDb` setting
- The content-type detector should adapt automatically — give it 5-10 seconds to classify the input

#### Build fails with "digital envelope routines::unsupported"
- This is an OpenSSL 3.x issue on Windows with Node.js
- Already fixed in `next.config.mjs`: `config.output.hashFunction = 'sha256'`
- If still occurring, update Node.js to 22 LTS

### 7.2 Debug Tools

#### Performance Profiling
- Enable `debugPerf` in Advanced settings → shows `PerfTimings` per frame
- Check `performanceMetrics` in FeedbackDetector state
- Use Chrome DevTools Performance tab with "Web Worker" checkbox enabled

#### Algorithm Debugging
- Enable Algorithm Status Bar (Display settings) to see real-time algorithm scores
- Check browser console for worker messages (filtered by `[DSP]` prefix)
- Use `pnpm test:coverage` to verify algorithm test coverage

#### FPS Monitoring
- The `useFpsMonitor` hook tracks frame rate
- Displayed in the header when enabled in Display settings
- Target: 60fps on desktop, 25fps on mobile

---

*This technical reference covers the core architecture and development workflows for Kill The Ring. For AI-specific context, see `docs/AI_CONTEXT.md`. For monetization and business strategy, see `docs/MONETIZATION.md`. For hardware integration specs, see `docs/INTEGRATIONS.md`.*
