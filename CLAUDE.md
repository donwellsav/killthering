# CLAUDE.md

## Project Overview

**Kill The Ring** is a real-time acoustic feedback detection and analysis tool for live sound engineers. It captures microphone input via the Web Audio API, identifies feedback frequencies using DSP algorithms, and delivers EQ recommendations with pitch translation. The app is **analysis-only** — it never outputs or modifies audio.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5.7 (strict mode)
- **UI:** shadcn/ui (New York style, Radix primitives), Tailwind CSS v4
- **Audio:** Web Audio API (AnalyserNode, Web Workers for DSP)
- **Visualization:** HTML5 Canvas
- **State:** React 19 hooks (no external state library)
- **Database:** Neon PostgreSQL (serverless, for session history)
- **Desktop:** Electron 33 + electron-builder
- **Package Manager:** pnpm

## Commands

```bash
pnpm dev              # Start Next.js dev server on :3000
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint (Next.js defaults)
pnpm export           # Static export for Electron
pnpm electron:dev     # Start Electron dev mode
```

## Project Structure

```
app/                        # Next.js App Router pages + API routes
  api/sessions/             # Session CRUD + event logging endpoints
  sessions/                 # Session history pages (server components)
components/
  kill-the-ring/            # Domain components (KillTheRing, SpectrumCanvas, SettingsPanel, etc.)
  ui/                       # shadcn/ui primitives
hooks/                      # Custom React hooks (useAudioAnalyzer, useDSPWorker, etc.)
lib/
  audio/                    # AudioAnalyzer factory
  db/                       # Neon PostgreSQL data access layer
  dsp/                      # DSP engine (~6,600 lines): detector, classifier, advisor, worker
  logging/                  # Session event logger
  utils/                    # Math helpers, pitch utilities
types/                      # TypeScript interfaces (advisory.ts)
styles/                     # Tailwind globals (OKLch theme)
scripts/                    # SQL migrations
```

## Architecture

- **Main thread:** AudioContext + AnalyserNode, FFT capture, requestAnimationFrame loop (60fps), React rendering
- **Web Worker** (`lib/dsp/dspWorker.ts`): TrackManager, Classifier, EQAdvisor — offloaded to keep UI at 60fps
- **Data flow:** Mic → GainNode → AnalyserNode → FFT data → Worker (classify) → React state → Canvas render
- Components in `components/kill-the-ring/` use barrel export via `index.ts`

## Coding Conventions

- **Components:** PascalCase, wrapped in `memo()`, explicit `'use client'` directive when needed
- **Hooks:** `use` prefix, camelCase (e.g., `useAudioAnalyzer`)
- **Types:** PascalCase; interfaces for objects, type aliases for unions; all domain types in `types/advisory.ts`
- **Constants:** SCREAMING_SNAKE_CASE, centralized in `lib/dsp/constants.ts`
- **Functions/variables:** camelCase
- **Private class members:** `_prefixed`
- **Imports:** Use `@/*` path alias (maps to project root)
- **Styling:** Tailwind utility classes + `cn()` from `lib/utils.ts` for conditional classes
- **No test framework configured** — rely on TypeScript strict mode and manual browser testing
