# Kill The Ring — AI Context Document

> **Purpose:** Structured context file optimized for AI model consumption. Feed this document to any AI assistant working on the Kill The Ring codebase.
> **Version:** 1.0 | **Date:** 2026-03-14 | **App Version:** 0.95.0

---

## 1. Project Manifest

### Identity
- **Name:** Kill The Ring
- **Domain:** killthering.com
- **Purpose:** Real-time acoustic feedback detection and analysis for live sound engineers
- **Key constraint:** Analysis-only — never outputs or modifies audio

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack dev) | 16.1.6 |
| Language | TypeScript (strict mode) | 5.7.3 |
| UI Components | shadcn/ui (New York style) + Radix primitives | Latest |
| Styling | Tailwind CSS v4 + tw-animate-css | 4.2.0 |
| Audio | Web Audio API (AnalyserNode, Web Workers) | Browser native |
| Visualization | HTML5 Canvas (pure drawing helpers) | Browser native |
| State | React 19 hooks (no external state library) | 19.2.4 |
| Testing | Vitest + V8 coverage | 4.0.18 |
| Error Reporting | Sentry (@sentry/nextjs) | 10.43.0 |
| PWA | Serwist (service worker, offline caching) | 9.5.6 |
| Package Manager | pnpm | 10.30.1 |
| Deployment | Vercel (auto-deploy on push to main) | — |

### Package Dependencies
**Runtime:** @radix-ui/* (7 packages), @sentry/nextjs, @serwist/next, class-variance-authority, clsx, jspdf, jspdf-autotable, lucide-react, next, react, react-dom, react-resizable-panels, tailwind-merge

**Dev:** @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, @vitest/coverage-v8, autoprefixer, eslint, eslint-config-next, postcss, serwist, tailwindcss, tw-animate-css, typescript, vitest

---

## 2. File Tree (Critical Paths)

```
/
├── CLAUDE.md                          # AI instructions (CRITICAL — read first)
├── package.json                       # v0.95.0, scripts: dev/build/start/lint/test
├── next.config.mjs                    # CSP headers, Sentry, Serwist, webpack config
├── tsconfig.json                      # strict: true, @/* path alias
├── eslint.config.mjs                  # Flat config, no-explicit-any: error
├── vitest.config.ts                   # V8 coverage, 80/80/70% thresholds
├── app/
│   ├── layout.tsx                     # Root layout with metadata
│   ├── page.tsx                       # Entry point → KillTheRing
│   ├── global-error.tsx               # Sentry error boundary
│   ├── sw.ts                          # Serwist service worker
│   ├── ~offline/page.tsx              # Offline fallback
│   └── api/v1/ingest/route.ts         # Spectral data ingest (POST)
├── components/
│   ├── kill-the-ring/                 # Domain components (22 files + barrel index.ts)
│   │   ├── KillTheRing.tsx            # Root orchestrator
│   │   ├── KillTheRingClient.tsx      # Client wrapper ('use client')
│   │   ├── SpectrumCanvas.tsx         # Canvas visualization
│   │   ├── GEQBarView.tsx             # GEQ overlay
│   │   ├── IssuesList.tsx             # Advisory list
│   │   ├── EarlyWarningPanel.tsx      # Pre-feedback warnings
│   │   ├── FeedbackHistoryPanel.tsx   # History panel
│   │   ├── AlgorithmStatusBar.tsx     # Algorithm status
│   │   ├── DetectionControls.tsx      # Start/stop + mode
│   │   ├── HeaderBar.tsx              # App header
│   │   ├── HelpMenu.tsx              # Help dropdown
│   │   ├── InputMeterSlider.tsx       # Level meter
│   │   ├── VerticalGainFader.tsx      # Gain control
│   │   ├── OnboardingOverlay.tsx      # First-run tutorial
│   │   ├── DataConsentDialog.tsx      # Data collection consent
│   │   ├── ErrorBoundary.tsx          # Error boundary
│   │   ├── DesktopLayout.tsx          # Desktop (landscape:flex)
│   │   ├── MobileLayout.tsx           # Mobile (WAI-ARIA tabs)
│   │   ├── SettingsPanel.tsx          # Settings container
│   │   └── settings/                  # 7 settings tab files
│   └── ui/                            # shadcn/ui primitives (20 files)
├── contexts/
│   ├── AudioAnalyzerContext.tsx        # Engine, settings, spectrum, devices
│   ├── AdvisoryContext.tsx             # Advisory state, actions
│   ├── UIContext.tsx                   # Mobile tab, freeze, fullscreen
│   └── PortalContainerContext.tsx      # Mobile portal mount
├── hooks/
│   ├── useAudioAnalyzer.ts            # Core: FeedbackDetector lifecycle
│   ├── useAudioDevices.ts             # Device enumeration
│   ├── useDSPWorker.ts                # Worker lifecycle
│   ├── useAdvisoryMap.ts              # Advisory Map state
│   ├── useAdvisoryLogging.ts          # Advisory logging
│   ├── useAnimationFrame.ts           # rAF loop
│   ├── useCalibrationSession.ts       # Calibration data
│   ├── useDataCollection.ts           # Spectral data collection
│   ├── useFullscreen.ts               # Fullscreen API
│   ├── useFpsMonitor.ts               # FPS tracking
│   └── use-mobile.ts                  # Mobile detection
├── lib/
│   ├── audio/                         # AudioAnalyzer factory
│   ├── calibration/                   # Room calibration (3 files)
│   ├── canvas/spectrumDrawing.ts      # Pure canvas drawing helpers
│   ├── data/                          # Anonymous data collection (4 files)
│   ├── dsp/                           # DSP ENGINE (17 modules):
│   │   ├── constants.ts               #   ~800 lines of tuning constants
│   │   ├── feedbackDetector.ts        #   Core: peak detection + persistence (~1730 lines)
│   │   ├── algorithmFusion.ts         #   7-algorithm weighted fusion (~500 lines)
│   │   ├── msdAnalysis.ts             #   MSD (DAFx-16) (~200 lines)
│   │   ├── phaseCoherence.ts          #   Phase coherence (KU Leuven 2025) (~150 lines)
│   │   ├── compressionDetection.ts    #   Spectral flatness + compression (~200 lines)
│   │   ├── classifier.ts             #   Track classification (~400 lines)
│   │   ├── eqAdvisor.ts              #   EQ recommendations + MINDS (~500 lines)
│   │   ├── dspWorker.ts              #   Worker orchestrator (~430 lines)
│   │   ├── workerFft.ts              #   FFT processing (~300 lines)
│   │   ├── advisoryManager.ts        #   Advisory lifecycle (~300 lines)
│   │   ├── decayAnalyzer.ts          #   Frequency decay analysis (~200 lines)
│   │   ├── trackManager.ts           #   Track lifecycle (~200 lines)
│   │   ├── acousticUtils.ts          #   Room acoustics (~300 lines)
│   │   ├── severityUtils.ts          #   Severity mapping (~100 lines)
│   │   ├── feedbackHistory.ts        #   Session history (~200 lines)
│   │   ├── advancedDetection.ts      #   Barrel re-export
│   │   └── __tests__/                #   7 unit test files
│   ├── export/                        # PDF/TXT/CSV/JSON export (3 files)
│   ├── storage/ktrStorage.ts          # Typed localStorage
│   └── utils/                         # Math helpers, pitch utilities
├── types/
│   ├── advisory.ts                    # Core DSP types (~200 lines)
│   ├── calibration.ts                 # Room profile, session types (~120 lines)
│   └── data.ts                        # Data collection types (~100 lines)
└── tests/dsp/                         # 7 integration test files
```

---

## 3. Code Conventions (Strict — Follow Exactly)

### Naming
| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase, `memo()` wrapped | `const SpectrumCanvas = memo(function SpectrumCanvas() {})` |
| Hooks | `use` prefix, camelCase | `useAudioAnalyzer`, `useDSPWorker` |
| Types/interfaces | PascalCase | `DetectedPeak`, `AnalysisConfig` |
| Constants | SCREAMING_SNAKE_CASE | `MOBILE_ANALYSIS_INTERVAL_MS`, `ISO_31_BANDS` |
| Functions/variables | camelCase | `calculateERB`, `feedbackProbability` |
| Private class members | `_prefixed` | `this._deviceChangeHandler` |
| Files (components) | PascalCase.tsx | `SpectrumCanvas.tsx` |
| Files (non-components) | camelCase.ts | `feedbackDetector.ts` |

### Imports
- Always use `@/*` path alias (maps to project root)
- Never use relative imports like `../../`
- Example: `import { ISO_31_BANDS } from '@/lib/dsp/constants'`

### Components
- Always wrapped in `memo()` for render optimization
- Always have `'use client'` directive when using browser APIs or hooks
- Use shadcn/ui primitives from `@/components/ui/`
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Touch targets ≥ 44×44px (`min-h-[44px] min-w-[44px]`)

### Canvas
- Pure drawing functions in `lib/canvas/` — no React dependency
- Use `{ current: T }` params, NOT `React.RefObject`
- Example: `function drawSpectrum(ctx: { current: CanvasRenderingContext2D }, data: Float32Array)`

### Constants
- ALL tuning constants centralized in `lib/dsp/constants.ts`
- Never hardcode magic numbers in DSP modules
- Group related constants in objects with descriptive comments

### Testing
- Vitest framework with `describe`/`it`/`expect`
- Academic references in test file headers
- Test file naming: `*.test.ts`
- Unit tests: `lib/dsp/__tests__/`
- Integration tests: `tests/dsp/`
- Coverage thresholds: 80% lines, 80% functions, 70% branches

### ESLint
- `@typescript-eslint/no-explicit-any` is **error** — never use `any`
- `no-console` is **warn** — minimize console usage
- `prefer-const` is **error** — always use `const` when possible

---

## 4. Type System Reference

### Core Types (`types/advisory.ts`)

```typescript
type Algorithm = 'msd' | 'phase' | 'spectral' | 'comb' | 'ihr' | 'ptmr'
type AlgorithmMode = 'auto' | 'custom' | 'msd' | 'phase' | 'combined' | 'all'
type ContentType = 'speech' | 'music' | 'compressed' | 'unknown'
type OperationMode = 'speech' | 'worship' | 'liveMusic' | 'theater' | 'monitors' | 'ringOut' | 'broadcast' | 'outdoor'
type SeverityLevel = 'RUNAWAY' | 'GROWING' | 'RESONANCE' | 'POSSIBLE_RING' | 'WHISTLE' | 'INSTRUMENT'
type IssueLabel = 'ACOUSTIC_FEEDBACK' | 'WHISTLE' | 'INSTRUMENT' | 'POSSIBLE_RING'
type ThresholdMode = 'absolute' | 'relative' | 'hybrid'
type Preset = 'surgical' | 'heavy'

interface AnalysisConfig {
  fftSize: number               // 4096 | 8192 | 16384
  minHz: number                 // Minimum analysis frequency
  maxHz: number                 // Maximum analysis frequency
  analysisIntervalMs: number    // ms between analyses (20-40ms)
  sustainMs: number             // ms to sustain detection
  clearMs: number               // ms before clearing advisory
  thresholdMode: ThresholdMode
  thresholdDb: number           // Absolute threshold
  relativeThresholdDb: number   // Relative to noise floor
  prominenceDb: number          // Peak prominence requirement
  neighborhoodBins: number      // Bins for local maximum check
  maxIssues: number             // Maximum simultaneous advisories
  preset: Preset
  mode: OperationMode
  aWeightingEnabled: boolean    // IEC 1672 A-weighting
  micCalibrationEnabled: boolean // ECM8000 compensation
  noiseFloorEnabled: boolean
  inputGainDb: number           // Software gain
  autoGainEnabled: boolean
}

interface DetectedPeak {
  binIndex: number
  trueFrequencyHz: number       // Quadratic-interpolated true frequency
  trueAmplitudeDb: number       // Corrected amplitude
  prominenceDb: number          // Above local median
  sustainedMs: number
  harmonicOfHz: number | null   // If harmonic of another peak
  msd?: number                  // MSD score (lower = more feedback-like)
  persistenceFrames?: number    // Consecutive frames at this frequency
  qEstimate?: number            // Estimated Q factor
  phpr?: number                 // Peak-to-Harmonic Power Ratio
}

interface Track {
  id: string
  binIndex: number
  trueFrequencyHz: number
  trueAmplitudeDb: number
  features: TrackFeatures       // Classification features
  qEstimate: number
  velocityDbPerSec: number      // Growth rate
  harmonicOfHz: number | null
}

interface TrackFeatures {
  stabilityCentsStd: number     // Pitch stability (low = feedback)
  meanQ: number
  minQ: number
  meanVelocityDbPerSec: number
  maxVelocityDbPerSec: number
  persistenceMs: number
  harmonicityScore: number      // 0-1, harmonic series strength
  modulationScore: number       // 0-1, amplitude modulation
  noiseSidebandScore: number    // 0-1, noise around peak
}

interface Advisory {
  id: string
  frequencyHz: number
  amplitudeDb: number
  severity: Severity
  issueLabel: IssueLabel
  eq: EQAdvisory                // Recommended EQ settings
  pitch: PitchInfo              // Note name + cents
  confidence: number
  // ... additional fields
}
```

### Algorithm Types (`lib/dsp/algorithmFusion.ts`)

```typescript
interface AlgorithmScores {
  msd: MSDResult | null
  phase: PhaseCoherenceResult | null
  spectral: SpectralFlatnessResult | null
  comb: CombPatternResult | null
  compression: CompressionResult | null
  ihr: InterHarmonicResult | null     // Inter-harmonic ratio
  ptmr: PTMRResult | null             // Peak-to-median ratio
}

interface FusedDetectionResult {
  feedbackProbability: number          // 0-1
  confidence: number                   // 0-1
  contributingAlgorithms: string[]
  algorithmScores: AlgorithmScores
  verdict: 'FEEDBACK' | 'POSSIBLE_FEEDBACK' | 'NOT_FEEDBACK' | 'UNCERTAIN'
  reasons: string[]
}

interface FusionConfig {
  weights: Record<Algorithm, number>   // Per-algorithm weights
  // ... mode-specific overrides
}
```

### Worker Message Types (`lib/dsp/dspWorker.ts`)

```typescript
// Inbound (main thread → worker)
type WorkerInboundMessage =
  | { type: 'init'; settings: DetectorSettings; sampleRate: number; fftSize: number }
  | { type: 'updateSettings'; settings: Partial<DetectorSettings> }
  | { type: 'processPeak'; peak: DetectedPeak; spectrum: Float32Array; sampleRate: number; fftSize: number; timeDomain?: Float32Array }
  | { type: 'clearPeak'; binIndex: number; frequencyHz: number; timestamp: number }
  | { type: 'reset' }

// Outbound (worker → main thread)
type WorkerOutboundMessage =
  | { type: 'advisory'; advisory: Advisory }
  | { type: 'advisoryReplaced'; replacedId: string; advisory: Advisory }
  | { type: 'advisoryCleared'; advisoryId: string }
  | { type: 'tracksUpdate'; tracks: TrackedPeak[] }
  | { type: 'returnBuffers'; spectrum: Float32Array; timeDomain?: Float32Array }
  | { type: 'ready' }
  | { type: 'error'; message: string }
```

---

## 5. Data Flow (Critical Path)

```
User grants mic permission
  ↓
AudioContext created (48kHz typical)
  ↓
MediaStream → GainNode → AnalyserNode (FFT size: 8192 default)
  ↓
requestAnimationFrame loop (60fps on main thread):
  ↓
analyser.getFloatFrequencyData(freqDb)  // Float32Array of dB values
analyser.getFloatTimeDomainData(timeDomain)  // For phase coherence
  ↓
FeedbackDetector.analyze():
  1. Apply A-weighting + ECM8000 calibration per bin
  2. Convert dB to power using EXP_LUT (precomputed)
  3. Build prefix sum for fast local median
  4. Find peaks (local maxima with prominence gate)
  5. Update MSD ring buffers per peak
  6. Score persistence (frame count)
  7. Compute Q estimate from -3dB bandwidth
  8. Fire onPeakDetected callback
  ↓
postMessage to Web Worker (transferable Float32Array):
  ↓
dspWorker.ts onmessage → processPeak:
  1. AlgorithmEngine.processFrame() → MSD, phase, amplitude analysis
  2. TrackManager.addPeak() → track lifecycle
  3. classifyTrackWithAlgorithms() → Bayesian + acoustic features
  4. fuseAlgorithmResults() → 7-algorithm weighted fusion → verdict
  5. generateEQAdvisory() → GEQ/PEQ/shelf + MINDS depth
  6. AdvisoryManager.processClassification() → create/update/clear advisory
  7. DecayAnalyzer → room mode decay analysis
  8. Temporal smoothing (ring-buffer majority vote on classification)
  ↓
postMessage back to main thread (advisory):
  ↓
React state update (via context):
  ↓
Canvas render (spectrum + GEQ overlay + advisory markers)
```

---

## 6. Performance-Critical Code Paths

### Hot Loop: `FeedbackDetector.analyze()` (~1730 lines total)
- Called 25-60 times/second
- Processes 4096-8192 FFT bins per call
- Uses `EXP_LUT` (precomputed Float32Array) instead of `Math.exp()`
- Uses `Float32Array` preallocated buffers (no GC)
- A-weighting + ECM8000 calibration applied per bin in same loop
- `buildPrefixSum()` for O(1) local median queries

### Worker Communication
- `Float32Array` spectrum data should use transferable objects (zero-copy)
- `returnBuffers` message returns transferred arrays for reuse
- Classification smoothing uses ring-buffer majority vote (avoids flickering)

### Canvas Rendering
- `requestAnimationFrame` at 60fps
- Pure drawing functions in `lib/canvas/spectrumDrawing.ts`
- No React re-renders for spectrum display (direct canvas API)

---

## 7. Known Issues & Future Enhancements

### Bugs
| ID | Description | File | Status |
|----|-------------|------|--------|
| BUG-001 | Spectral flatness returns 0.035 for broad peaks (expected >0.2) | `lib/dsp/compressionDetection.ts` | `it.todo()` in test |

### Incomplete Features
| ID | Description | File | Status |
|----|-------------|------|--------|
| FUTURE-002 | Frame-rate-independent persistence scoring | `lib/dsp/feedbackDetector.ts` | Partially implemented (5 code locations) |

### Test Coverage Gaps
| File | Coverage | Gap |
|------|----------|-----|
| `feedbackDetector.ts` | 12.7% | Web Audio integration methods untested |
| `classifier.ts` | 43.7% | Edge cases in Bayesian classification |
| `dspWorker.ts` | 0% | Excluded from coverage; message dispatch untested |

---

## 8. Anti-Patterns (Things NOT To Do)

1. **Never use `any`** — `@typescript-eslint/no-explicit-any` is error-level
2. **Never modify `DesktopLayout.tsx` for mobile** — mobile changes go in `MobileLayout.tsx`
3. **Never hardcode DSP constants** — all go in `lib/dsp/constants.ts`
4. **Never use relative imports** — always `@/*` path alias
5. **Never skip `memo()` on components** — all components wrapped in `memo()`
6. **Never use `React.RefObject` in canvas functions** — use `{ current: T }` instead
7. **Never output or modify audio** — the app is analysis-only
8. **Never store PII in data collection** — types/data.ts has NON-NEGOTIABLE privacy invariants
9. **Never use `git push` without explicit user permission** — per CLAUDE.md
10. **Never add external state libraries** — React 19 hooks only (no Redux, Zustand, Jotai)
11. **Never import `jspdf` statically** — use dynamic `import()` to keep bundle small
12. **Never add `@ts-ignore` or `@ts-expect-error`** — fix the type error instead
13. **Never create documentation files unless explicitly requested** — per coding conventions

---

## 9. Academic References

The DSP engine references these papers/sources — cite them when implementing related features:

| Algorithm | Reference | Key Contribution |
|-----------|-----------|-----------------|
| MSD (Magnitude Slope Deviation) | DAFx-16 conference paper | Temporal stability metric for spectral peaks |
| Phase Coherence | KU Leuven 2025 | Phase-locked loop detection for feedback |
| ERB (Equivalent Rectangular Bandwidth) | Glasberg & Moore, 1990 | Psychoacoustic bandwidth for EQ depth scaling |
| Schroeder Frequency | Sound Insulation textbook, Carl Hopkins, 2007 | Room mode transition frequency |
| A-weighting | IEC 61672 | Frequency-dependent loudness perception |
| ECM8000 Calibration | CSL #746 | 38-point measurement mic frequency response |
| Comb Pattern Detection | DBX paper | Acoustic path length estimation from harmonic spacing |
| MINDS (Notch Depth Setting) | DAFx-16 paper | MSD-informed adaptive notch depth |

---

## 10. Build & Test Commands

```bash
pnpm dev              # Dev server (Turbopack, no SW, port 3000)
pnpm build            # Production build (webpack, generates SW)
pnpm start            # Production server
pnpm lint             # ESLint (flat config)
pnpm test             # Vitest (326 tests, ~1.5s)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # V8 coverage report
npx tsc --noEmit      # Type-check (run before build)
```

**CI gate (must all pass before PR):** `npx tsc --noEmit && pnpm test && pnpm build`

---

*This context document is designed to be fed to AI assistants (Claude, ChatGPT, Gemini) when working on the Kill The Ring codebase. It provides the minimum necessary context for accurate code generation and review.*
