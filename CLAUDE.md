# CLAUDE.md

## CRITICAL RULES

- **NEVER run `git push` unless the user explicitly says "push" or "send to GitHub".** Committing locally is fine. Pushing is NOT. No exceptions.

## Project Overview

**Kill The Ring** is a real-time acoustic feedback detection and analysis tool for live sound engineers. It captures microphone input via the Web Audio API, identifies feedback frequencies using DSP algorithms, and delivers EQ recommendations with pitch translation. The app is **analysis-only** — it never outputs or modifies audio.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5.7 (strict mode)
- **UI:** shadcn/ui (New York style, Radix primitives), Tailwind CSS v4
- **Audio:** Web Audio API (AnalyserNode, Web Workers for DSP)
- **Visualization:** HTML5 Canvas
- **State:** React 19 hooks (no external state library)
- **Testing:** Vitest (323 DSP unit tests across 14 test files)
- **Error Reporting:** Sentry (browser + server + edge runtime, source maps)
- **PWA:** Serwist (service worker, offline caching, installable)
- **Package Manager:** pnpm

## Commands

```bash
pnpm dev              # Start Next.js dev server on :3000 (Turbopack, no SW)
pnpm build            # Production build (webpack, generates SW)
pnpm start            # Start production server
pnpm lint             # Run ESLint (flat config, eslint.config.mjs)
pnpm test             # Run Vitest tests (323 DSP unit tests)
pnpm test:watch       # Vitest in watch mode
pnpm test:coverage    # Vitest with V8 coverage
npx tsc --noEmit      # Type-check without emitting (run before pnpm build)
```

## Project Structure

```
app/                        # Next.js App Router pages + API routes
  layout.tsx                #   Root layout with metadata + Sentry
  page.tsx                  #   Entry point — renders KillTheRing
  global-error.tsx          #   Global error boundary (Sentry)
  sw.ts                     #   Serwist service worker
  ~offline/page.tsx         #   Offline fallback page
  api/v1/ingest/route.ts    #   Spectral snapshot ingest endpoint
components/
  kill-the-ring/            # Domain components (23 files + barrel index.ts)
    settings/               # Settings panel tab components (7 files)
  ui/                       # shadcn/ui primitives (20 files)
contexts/                   # React context providers (4 files):
  PortalContainerContext.tsx #   Portal mount point for mobile overlays
  AdvisoryContext.tsx       #   Advisory state, dismiss/clear/false-positive actions
  AudioAnalyzerContext.tsx  #   Audio engine, settings, devices, spectrum, detection
  UIContext.tsx             #   Mobile tab, freeze, fullscreen, layout reset
hooks/                      # Custom React hooks (11 files)
lib/
  audio/                    # AudioAnalyzer factory
  calibration/              # Calibration system (3 files):
    calibrationSession.ts   #   Session data collection (detections, missed, spectra, settings)
    calibrationExport.ts    #   JSON export builder with room profile + session data
    index.ts                #   Barrel export
  canvas/                   # Pure canvas drawing helpers (no React dependency)
    spectrumDrawing.ts      #   Spectrum/GEQ canvas render functions
  changelog.ts              # Version history (auto-updated by CI, rendered in About tab)
  data/                     # Anonymous spectral data collection (4 files):
    consent.ts              #   Opt-out consent management (localStorage)
    snapshotCollector.ts    #   Spectrum snapshot ring buffer
    uploader.ts             #   Batch upload to /api/v1/ingest
    index.ts                #   Barrel export
  dsp/                      # DSP engine (17 modules + tests):
    feedbackDetector.ts     #   Core peak detection + persistence scoring
    advancedDetection.ts    #   Barrel re-export for msdAnalysis, phaseCoherence, compressionDetection, algorithmFusion
    msdAnalysis.ts          #   Magnitude Slope Deviation (DAFx-16)
    phaseCoherence.ts       #   Phase coherence analysis (KU Leuven 2025)
    compressionDetection.ts #   Spectral flatness + compression ratio estimation
    algorithmFusion.ts      #   Weighted fusion of all algorithm scores → verdict
    classifier.ts           #   Track classification (feedback vs harmonic vs transient)
    eqAdvisor.ts            #   EQ recommendation generation (GEQ/PEQ/shelf + MINDS)
    trackManager.ts         #   Track lifecycle management
    acousticUtils.ts        #   Room acoustics (RT60, Schroeder freq, modal overlap)
    severityUtils.ts        #   Severity level mapping (RUNAWAY → POSSIBLE_RING)
    feedbackHistory.ts      #   Persistent session history + repeat offender tracking
    workerFft.ts            #   FFT processing, peak extraction, processFrame entry point
    advisoryManager.ts      #   Advisory lifecycle: creation, updates, resolution, pruning
    decayAnalyzer.ts        #   Frequency decay analysis + recentDecays management
    dspWorker.ts            #   Web Worker orchestrator (~430 lines)
    constants.ts            #   All DSP tuning constants + operation mode presets
    __tests__/              #   Vitest unit tests (7 files, ~188 tests):
      feedbackDetector.test.ts
      classifier.test.ts
      eqAdvisor.test.ts
      algorithmFusion.test.ts
      compressionDetection.test.ts
      phaseCoherence.test.ts
      msdConsistency.test.ts
tests/dsp/                  #   Integration/scenario tests (7 files, ~135 tests):
  algorithmFusion.test.ts
  algorithmFusion.gpt.test.ts
  algorithmFusion.chatgpt.test.ts
  algorithmFusion.chatgpt-context.test.ts
  compressionDetection.test.ts
  msdAnalysis.test.ts
  phaseCoherence.test.ts
  export/                   # Multi-format export (3 files):
    downloadFile.ts         #   Browser download trigger via Blob + <a> element
    exportPdf.ts            #   PDF report generation (jsPDF, dynamic import)
    exportTxt.ts            #   Fixed-width plain text report
  utils/                    # Math helpers, pitch utilities
  utils.ts                  # cn() helper for Tailwind class merging
types/                      # TypeScript interfaces:
  advisory.ts               #   Core DSP types (Advisory, DetectorSettings, Track, etc.)
  calibration.ts            #   Room profile, session data, export formats, stats
  data.ts                   #   Data collection types (ConsentState, SnapshotBatch, worker messages)
```

## Architecture

- **Main thread:** AudioContext + AnalyserNode, FFT capture, requestAnimationFrame loop (60fps), React rendering
- **Web Worker** (`lib/dsp/dspWorker.ts`): Orchestrator (~430 lines) importing `workerFft`, `advisoryManager`, `decayAnalyzer` — offloaded to keep UI at 60fps
- **Data flow:** Mic → GainNode → AnalyserNode → FFT data → Worker (classify) → React state → Canvas render
- **State management:** Three focused contexts — `AudioAnalyzerContext` (engine, settings, devices, spectrum, detection), `AdvisoryContext` (advisory state, dismiss/clear actions), `UIContext` (mobile tab, freeze, fullscreen, layout) — eliminate prop drilling through layouts
- Components in `components/kill-the-ring/` use barrel export via `index.ts`
- `contexts/PortalContainerContext.tsx` provides a portal mount point for mobile overlays
- **Security headers:** `next.config.mjs` sets `Content-Security-Policy` (strict prod, relaxed dev with `unsafe-inline`/`unsafe-eval`/`ws:`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` (microphone only)
- **Error reporting:** Sentry integration across three runtimes — `instrumentation-client.ts` (browser), `sentry.server.config.ts` (Node.js), `sentry.edge.config.ts` (Edge). `ErrorBoundary` and DSP worker report to Sentry. Source maps uploaded via `@sentry/nextjs` build plugin.
- **Environment variables:** Optional `NEXT_PUBLIC_SENTRY_DSN` for error reporting (see `.env.example`). App is fully client-side with localStorage persistence — no env vars required to run.
- **Changelog:** `lib/changelog.ts` is auto-updated by GitHub Actions on PR merge (`auto-version.yml`) and direct push (`patch-on-push.yml`). Rendered in About tab.
- **Calibration:** `lib/calibration/` collects room profile (dimensions, materials, mics), ambient noise baseline, detection events, missed-feedback annotations, settings changes, and spectrum snapshots — exports as JSON v1.1 with per-event `micCalibrationApplied` flags and `MicCalibrationMetadata` (38-point ECM8000 calibration curve)
- **Mic Calibration:** ECM8000 frequency response compensation (CSL #746) applied per FFT bin in `feedbackDetector.ts` hot loop alongside A-weighting; toggle in Calibrate tab; curve data in `lib/dsp/constants.ts` (`ECM8000_CALIBRATION`)
- **Export:** `lib/export/` provides multi-format export (PDF via jsPDF dynamic import, TXT, CSV, JSON) with browser download trigger
- **Mobile:** MobileLayout uses WAI-ARIA tabs pattern (roving tabindex, ArrowLeft/Right/Home/End keyboard nav); DesktopLayout uses `landscape:flex` CSS toggle — never modify DesktopLayout for mobile-specific changes
- **Data collection:** Anonymous spectral snapshots (opt-out, no PII) collected via `lib/data/` → `useDataCollection` hook → `/api/v1/ingest` endpoint. Consent managed in localStorage. Types in `types/data.ts`.
- **Accessibility:** Touch targets ≥44×44px (`min-h-[44px] min-w-[44px]`), `role="status"` sr-only spans for clipboard announcements

## Coding Conventions

- **Components:** PascalCase, wrapped in `memo()`, explicit `'use client'` directive when needed
- **Hooks:** `use` prefix, camelCase (e.g., `useAudioAnalyzer`)
- **Types:** PascalCase; interfaces for objects, type aliases for unions; core DSP types in `types/advisory.ts`, calibration types in `types/calibration.ts`, data collection types in `types/data.ts`
- **Constants:** SCREAMING_SNAKE_CASE, centralized in `lib/dsp/constants.ts`
- **Functions/variables:** camelCase
- **Private class members:** `_prefixed`
- **Imports:** Use `@/*` path alias (maps to project root)
- **Code splitting:** Large modules use barrel re-exports (`export * from './subModule'`); dialogs/panels use `React.lazy()` with `.then(m => ({ default: m.X }))` for named exports
- **Canvas functions:** Pure drawing helpers in `lib/canvas/` — use `{ current: T }` params, not `React.RefObject`
- **Styling:** Tailwind utility classes + `cn()` from `lib/utils.ts` for conditional classes
- **Testing:** Vitest for DSP unit tests (`pnpm test`); 323 tests across 14 files (7 unit in `lib/dsp/__tests__/`, 7 integration/scenario in `tests/dsp/`)
- **ESLint:** Flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + typescript + `@typescript-eslint/no-explicit-any` error; React 19 experimental rules (`set-state-in-effect`, `refs`, `purity`) downgraded to warn
- **Build verification:** `npx tsc --noEmit && pnpm test && pnpm build` — must all pass before PRs
- **Export formats:** PDF uses dynamic `import()` to avoid bundling jsPDF unless needed; CSV/JSON/TXT are synchronous

## CI/CD

- **Build gate:** GitHub Actions (`ci.yml`) runs `tsc --noEmit`, `pnpm test`, and `pnpm build` on every push and PR
- **Versioning:** `0.{PR_NUMBER}.0` — PR merge sets version to PR number (`auto-version.yml`), direct push increments patch (`patch-on-push.yml`). Both commit with `[skip ci]`.
- **Deployment:** Vercel auto-deploys on push to `main`; the `[skip ci]` in auto-version commits prevents double-deploys
- **Version flow:** `package.json` version → `next.config.mjs` reads via `readFileSync` → `NEXT_PUBLIC_APP_VERSION` env → HeaderBar + HelpMenu
