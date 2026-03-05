export type ChangeType = 'feat' | 'fix' | 'perf' | 'refactor' | 'ui'

export interface Change {
  type: ChangeType
  description: string
}

export interface ChangelogEntry {
  version: string
  date: string
  highlights?: string
  changes: Change[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.66',
    date: '2026-03-05',
    changes: [
      { type: 'feat', description: 'Retunes 9 DSP parameters across `OPERATION_MODES.speech`, `DEFAULT_CONFIG`, and `DEFAULT_SETTINGS` to better serve both soundcheck and live conference scenarios' },
      { type: 'feat', description: 'Widens frequency range to 10kHz (was 8kHz) to catch condenser sibilance feedback' },
      { type: 'feat', description: 'Raises confidence threshold to 0.40, prominence to 10dB, and sustain to 350ms to reduce false positives while still catching real feedback early' },
      { type: 'feat', description: '[ ] Verify build passes (`pnpm build` ✅)' },
      { type: 'feat', description: '[ ] Open app in speech mode — confirm settings panel shows updated defaults' },
      { type: 'feat', description: '[ ] Test with speech input — confirm fewer false positives than before' },
      { type: 'feat', description: '[ ] Switch modes (worship → speech → liveMusic) — confirm speech values apply correctly' },
    ],
  },
  {
    version: '1.0.65',
    date: '2026-03-05',
    changes: [
      { type: 'feat', description: 'Auto-gain now calibrates for 3 seconds on start, then **freezes** at the computed gain value' },
      { type: 'feat', description: 'Eliminates gain pumping that caused noise floor tracking instability and false positive detections' },
      { type: 'feat', description: 'Calibration requires minimum 30 signal frames (~0.6s of actual audio) to prevent locking on transient blips' },
      { type: 'feat', description: 'UI toggle shows **Cal** (pulsing amber) during calibration and **Lock** (green) when frozen' },
      { type: 'feat', description: 'Re-enabling auto-gain or restarting the analyzer resets calibration fresh' },
      { type: 'feat', description: '[ ] Start analysis with auto-gain enabled — verify button shows "Cal" with amber pulse' },
      { type: 'feat', description: '[ ] Wait 3+ seconds with signal present — verify button changes to "Lock" (green)' },
      { type: 'feat', description: '[ ] Confirm gain value stays fixed after lock (no more EMA updates)' },
      { type: 'feat', description: '[ ] Toggle auto-gain off then on — verify calibration restarts (amber pulse again)' },
      { type: 'feat', description: '[ ] Stop and restart analysis — verify calibration restarts' },
      { type: 'feat', description: '[ ] Test with no signal (silence) — verify calibration timer doesn\'t start until signal arrives' },
    ],
  },
  {
    version: '1.0.7',
    date: '2026-03-04',
    highlights: 'UI overhaul & auto-versioning',
    changes: [
      { type: 'ui', description: 'HelpMenu consolidated from 7 tabs to 5 with accordion-based algorithms' },
      { type: 'ui', description: 'SettingsPanel reorganized into 5 tabs with collapsible sections and Room Acoustics tab' },
      { type: 'feat', description: 'Auto-versioning GitHub Action bumps version on PR merge' },
      { type: 'ui', description: 'Issue cards now show captured frequency as primary display' },
      { type: 'feat', description: 'Added comprehensive beginner developer guide' },
    ],
  },
  {
    version: '1.0.6',
    date: '2026-03-04',
    highlights: 'Codebase hardening & cleanup',
    changes: [
      { type: 'refactor', description: 'Removed Neon PostgreSQL database layer and session persistence' },
      { type: 'refactor', description: 'Removed in-memory EventLogger and log export UI' },
      { type: 'refactor', description: 'Extracted getSeverityUrgency to shared DSP module' },
      { type: 'fix', description: 'Capped hotspot events to 50 to prevent unbounded localStorage growth' },
      { type: 'refactor', description: 'Added ErrorBoundary, memo(), useCallback across components' },
      { type: 'refactor', description: 'Removed 8 unused dependencies, migrated to ESLint flat config' },
    ],
  },
  {
    version: '1.0.5',
    date: '2026-03-04',
    highlights: 'Acoustic physics engine',
    changes: [
      { type: 'feat', description: 'Eyring RT60 reverberation time estimation' },
      { type: 'feat', description: 'Air absorption modeling for high-frequency Q adjustment' },
      { type: 'feat', description: 'Room mode filtering and mode clustering' },
      { type: 'feat', description: 'Frequency-dependent prominence thresholds' },
      { type: 'feat', description: 'Decay rate analysis passed to classifier' },
    ],
  },
  {
    version: '1.0.4',
    date: '2026-03-04',
    highlights: 'False positive elimination',
    changes: [
      { type: 'fix', description: 'Raised signal gate and prominence floor to 10 dB' },
      { type: 'fix', description: 'Unified merge windows and increased cooldowns' },
      { type: 'feat', description: 'Global advisory rate limiter (max 1 new/sec)' },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-03-04',
    highlights: 'Duplicate detection fixes',
    changes: [
      { type: 'fix', description: 'Reduced false positive and duplicate feedback detections' },
      { type: 'fix', description: 'Fixed 42 audit findings: DSP correctness, component bugs, API hardening' },
      { type: 'fix', description: 'Widened merge tolerance with band cooldown and bidirectional harmonic check' },
      { type: 'perf', description: 'Optimized DSP presets for load-in, tightened fusion threshold' },
      { type: 'fix', description: 'Fixed Vercel deploy: lazy DB connection, lockfile cleanup' },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-03-04',
    highlights: 'Auto-gain, mobile layout, PWA',
    changes: [
      { type: 'feat', description: 'Auto-gain control with settings UI' },
      { type: 'feat', description: 'GEQ-band advisory deduplication (one per 1/3 octave)' },
      { type: 'ui', description: 'Mobile layout: replaced hamburger with bottom tab bar' },
      { type: 'feat', description: 'About tab with dynamic version display' },
      { type: 'feat', description: 'GEQ band frequency shown in issue cards' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-03',
    highlights: 'Initial release',
    changes: [
      { type: 'feat', description: 'Replaced Electron with PWA via Serwist' },
      { type: 'ui', description: 'Resizable layout with research-driven operation mode presets' },
      { type: 'ui', description: 'Help menu redesign with 6-tab Operator\'s Manual' },
      { type: 'ui', description: 'Settings panel redesign with GEQ band labels' },
      { type: 'feat', description: '7-algorithm fusion: MSD, Phase, Spectral, Comb, IHR, PTMR, Compression' },
      { type: 'feat', description: 'Acoustic classifier with RT60-aware Q adjustments' },
      { type: 'feat', description: 'Feedback history with repeat offender tracking' },
      { type: 'feat', description: 'Real-time spectrum, GEQ, and amplitude visualization' },
    ],
  },
]
