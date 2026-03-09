'use client'

import React, { useRef, useEffect, useCallback, useState, memo } from 'react'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import { freqToLogPosition, logPositionToFreq, roundFreqToNice, clamp } from '@/lib/utils/mathHelpers'
import { getSeverityColor } from '@/lib/dsp/eqAdvisor'
import { formatFrequency } from '@/lib/utils/pitchUtils'
import { CANVAS_SETTINGS, VIZ_COLORS } from '@/lib/dsp/constants'
import type { SpectrumData, Advisory } from '@/types/advisory'
import type { EarlyWarning } from '@/hooks/useAudioAnalyzer'

// ─── Types for drawing functions ───────────────────────────────────────────────

interface DbRange {
  dbMin: number
  dbMax: number
  freqMin: number
  freqMax: number
}

// ─── Pure drawing functions (module-level, no component state) ─────────────────

const DB_MAJOR = [-90, -60, -30, 0]
const DB_MINOR = [-80, -70, -50, -40, -20, -10]
const DB_ALL = [...DB_MAJOR, ...DB_MINOR].sort((a, b) => a - b)

function calcPadding(width: number, height: number) {
  return {
    top: Math.round(height * 0.05),
    right: Math.round(width * 0.02),
    bottom: Math.round(height * 0.09),
    left: Math.round(width * 0.065),
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
) {
  // Background
  ctx.fillStyle = '#0c0c0c'
  ctx.fillRect(0, 0, plotWidth, plotHeight)

  // Minor dB grid (subtle, drawn first)
  ctx.strokeStyle = '#161616'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (const db of DB_MINOR) {
    const y = ((range.dbMax - db) / (range.dbMax - range.dbMin)) * plotHeight
    ctx.moveTo(0, y)
    ctx.lineTo(plotWidth, y)
  }
  ctx.stroke()

  // Major dB grid (brighter, on top)
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const db of DB_MAJOR) {
    const y = ((range.dbMax - db) / (range.dbMax - range.dbMin)) * plotHeight
    ctx.moveTo(0, y)
    ctx.lineTo(plotWidth, y)
  }
  ctx.stroke()

  // Frequency grid
  ctx.strokeStyle = '#1e1e1e'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (const freq of FREQ_LABELS) {
    const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    ctx.moveTo(x, 0)
    ctx.lineTo(x, plotHeight)
  }
  ctx.stroke()
}

function drawIndicatorLines(
  ctx: CanvasRenderingContext2D,
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
  spectrum: SpectrumData | null,
  showThresholdLine: boolean,
  feedbackThresholdDb: number | undefined,
  fontSize: number,
) {
  // Noise floor
  if (spectrum?.noiseFloorDb !== null && spectrum?.noiseFloorDb !== undefined) {
    const floorY = ((range.dbMax - spectrum.noiseFloorDb) / (range.dbMax - range.dbMin)) * plotHeight
    ctx.strokeStyle = VIZ_COLORS.NOISE_FLOOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, floorY)
    ctx.lineTo(plotWidth, floorY)
    ctx.stroke()
    ctx.setLineDash([])
    // Right-aligned label
    ctx.font = `${Math.max(8, fontSize - 2)}px monospace`
    ctx.fillStyle = VIZ_COLORS.NOISE_FLOOR
    ctx.globalAlpha = 0.7
    ctx.textAlign = 'right'
    ctx.fillText('Floor', plotWidth - 4, floorY - 4)
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
  }

  // Effective threshold
  if (showThresholdLine && spectrum?.effectiveThresholdDb != null) {
    const threshY = ((range.dbMax - spectrum.effectiveThresholdDb) / (range.dbMax - range.dbMin)) * plotHeight
    ctx.strokeStyle = VIZ_COLORS.THRESHOLD
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(0, threshY)
    ctx.lineTo(plotWidth, threshY)
    ctx.stroke()
    ctx.setLineDash([])
    // Right-aligned label
    const threshLabel = `Thresh +${feedbackThresholdDb ?? 0}dB`
    ctx.font = `${Math.max(8, fontSize - 2)}px monospace`
    ctx.fillStyle = VIZ_COLORS.THRESHOLD
    ctx.textAlign = 'right'
    ctx.fillText(threshLabel, plotWidth - 4, threshY - 4)
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
  }
}

// Peak hold decay rate: ~0.5 dB per frame at 60fps (~30 dB/sec)
const PEAK_HOLD_DECAY_DB = 0.5

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
  spectrum: SpectrumData | null,
  gradientRef: React.RefObject<CanvasGradient | null>,
  gradientHeightRef: React.RefObject<number>,
  spectrumLineWidth: number,
  peakHoldRef: React.MutableRefObject<Float32Array | null>,
) {
  if (!spectrum?.freqDb || !spectrum.sampleRate || !spectrum.fftSize) return

  const freqDb = spectrum.freqDb
  const hzPerBin = spectrum.sampleRate / spectrum.fftSize
  const n = freqDb.length

  // ── Update peak hold buffer ──────────────────────────────────
  let peakHold = peakHoldRef.current
  if (!peakHold || peakHold.length !== n) {
    peakHold = new Float32Array(n)
    peakHold.set(freqDb) // Initialize to current spectrum
    peakHoldRef.current = peakHold
  } else {
    for (let i = 0; i < n; i++) {
      peakHold[i] = Math.max(freqDb[i], peakHold[i] - PEAK_HOLD_DECAY_DB)
    }
  }

  // Cached gradient fill — only recreated when plotHeight changes
  let gradient = gradientRef.current
  if (!gradient || gradientHeightRef.current !== plotHeight) {
    gradient = ctx.createLinearGradient(0, 0, 0, plotHeight)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.85)')
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.35)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)')
    ;(gradientRef as React.MutableRefObject<CanvasGradient | null>).current = gradient
    ;(gradientHeightRef as React.MutableRefObject<number>).current = plotHeight
  }

  // Single pass: build stroke path, then derive fill from it
  const strokePath = new Path2D()
  const fillPath = new Path2D()
  let lastX = 0
  let started = false

  for (let i = 1; i < n; i++) {
    const freq = i * hzPerBin
    if (freq < range.freqMin || freq > range.freqMax) continue

    const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    const db = clamp(freqDb[i], range.dbMin, range.dbMax)
    const y = ((range.dbMax - db) / (range.dbMax - range.dbMin)) * plotHeight

    if (!started) {
      strokePath.moveTo(x, y)
      fillPath.moveTo(x, plotHeight)
      fillPath.lineTo(x, y)
      started = true
    } else {
      strokePath.lineTo(x, y)
      fillPath.lineTo(x, y)
    }
    lastX = x
  }

  // Complete fill path back to baseline
  fillPath.lineTo(lastX, plotHeight)
  fillPath.closePath()

  // Draw fill then stroke (with glow)
  ctx.fillStyle = gradient
  ctx.fill(fillPath)

  // Glow pass — wider, semi-transparent
  ctx.strokeStyle = VIZ_COLORS.SPECTRUM
  ctx.globalAlpha = 0.15
  ctx.lineWidth = spectrumLineWidth + 2
  ctx.stroke(strokePath)

  // Sharp pass — crisp line on top
  ctx.globalAlpha = 1
  ctx.lineWidth = spectrumLineWidth
  ctx.stroke(strokePath)

  // ── Peak hold trace — thin white line above spectrum ──────────
  const holdPath = new Path2D()
  let holdStarted = false
  for (let i = 1; i < n; i++) {
    const freq = i * hzPerBin
    if (freq < range.freqMin || freq > range.freqMax) continue

    const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    const db = clamp(peakHold[i], range.dbMin, range.dbMax)
    const y = ((range.dbMax - db) / (range.dbMax - range.dbMin)) * plotHeight

    if (!holdStarted) {
      holdPath.moveTo(x, y)
      holdStarted = true
    } else {
      holdPath.lineTo(x, y)
    }
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke(holdPath)
}

function drawFreqRangeOverlay(
  ctx: CanvasRenderingContext2D,
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
  freqRange: { min: number; max: number },
) {
  const rangeMinX = freqToLogPosition(Math.max(freqRange.min, range.freqMin), range.freqMin, range.freqMax) * plotWidth
  const rangeMaxX = freqToLogPosition(Math.min(freqRange.max, range.freqMax), range.freqMin, range.freqMax) * plotWidth

  // Dim overlay outside detection range
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  if (rangeMinX > 0) ctx.fillRect(0, 0, rangeMinX, plotHeight)
  if (rangeMaxX < plotWidth) ctx.fillRect(rangeMaxX, 0, plotWidth - rangeMaxX, plotHeight)

  // Vertical boundary lines
  const lineColor = '#3b82f6' // blue-500
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.85

  // Min line
  ctx.beginPath()
  ctx.moveTo(rangeMinX, 0)
  ctx.lineTo(rangeMinX, plotHeight)
  ctx.stroke()

  // Max line
  ctx.beginPath()
  ctx.moveTo(rangeMaxX, 0)
  ctx.lineTo(rangeMaxX, plotHeight)
  ctx.stroke()

  // Grab handles (small rounded rects at vertical center)
  const handleW = 6
  const handleH = 24
  const handleY = (plotHeight - handleH) / 2
  ctx.fillStyle = lineColor
  ctx.globalAlpha = 0.7

  // Min handle
  const minHandleRect = new Path2D()
  minHandleRect.roundRect(rangeMinX - handleW / 2, handleY, handleW, handleH, 3)
  ctx.fill(minHandleRect)

  // Max handle
  const maxHandleRect = new Path2D()
  maxHandleRect.roundRect(rangeMaxX - handleW / 2, handleY, handleW, handleH, 3)
  ctx.fill(maxHandleRect)

  ctx.globalAlpha = 1
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
  earlyWarning: EarlyWarning | null | undefined,
  advisories: Advisory[],
  clearedIds: Set<string> | undefined,
  peakMarkerRadius: number,
  fontSize: number,
) {
  // Early warning predictions
  if (earlyWarning && earlyWarning.predictedFrequencies.length > 0) {
    const warningColor = '#f59e0b' // amber-500
    ctx.strokeStyle = warningColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.globalAlpha = 0.6

    for (const freq of earlyWarning.predictedFrequencies) {
      if (freq < range.freqMin || freq > range.freqMax) continue
      const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth

      // Vertical dashed line
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, plotHeight)
      ctx.stroke()

      // Warning triangle at top
      ctx.fillStyle = warningColor
      ctx.beginPath()
      ctx.moveTo(x, 8)
      ctx.lineTo(x - 5, 0)
      ctx.lineTo(x + 5, 0)
      ctx.closePath()
      ctx.fill()
    }

    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // Advisory peak markers (persist until cleared, cap at 7)
  const visibleAdvisories = advisories
    .filter(a => !clearedIds?.has(a.id))
    .slice(-7)
  for (const advisory of visibleAdvisories) {
    const freq = advisory.trueFrequencyHz
    const db = advisory.trueAmplitudeDb
    const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    const y = ((range.dbMax - clamp(db, range.dbMin, range.dbMax)) / (range.dbMax - range.dbMin)) * plotHeight
    const color = getSeverityColor(advisory.severity)

    // Vertical line
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, plotHeight)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Peak dot
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, peakMarkerRadius, 0, Math.PI * 2)
    ctx.fill()

    // Frequency label
    ctx.fillStyle = color
    ctx.font = `${fontSize + 3}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(formatFrequency(freq), x, y - 10)
  }
}

function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  padding: { top: number; left: number; right: number; bottom: number },
  plotWidth: number,
  plotHeight: number,
  range: DbRange,
  fontSize: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = VIZ_COLORS.AXIS_LABEL
  ctx.font = `${fontSize}px monospace`
  ctx.textBaseline = 'middle'

  // Y-axis (dB)
  ctx.textAlign = 'right'
  for (const db of DB_ALL) {
    const y = padding.top + ((range.dbMax - db) / (range.dbMax - range.dbMin)) * plotHeight
    ctx.fillText(`${db}`, padding.left - 5, y)
  }

  // X-axis (Hz)
  ctx.textAlign = 'center'
  const xLabelY = padding.top + plotHeight + padding.bottom * 0.55
  for (const freq of FREQ_LABELS) {
    const x = padding.left + freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`
    ctx.fillText(label, x, xLabelY)
  }
}

// ─── Placeholder spectrum (static ambient noise curve) ─────────────────────────

// Frequency→dB points describing a realistic idle room noise shape
const PLACEHOLDER_CURVE: [number, number][] = [
  [20, -92], [30, -88], [50, -78], [80, -70], [120, -64],
  [200, -58], [350, -55], [500, -54], [800, -56], [1200, -60],
  [2000, -64], [3500, -69], [5000, -74], [8000, -80], [12000, -86],
  [16000, -91], [20000, -95],
]

function drawPlaceholder(
  canvas: HTMLCanvasElement,
  graphFontSize: number,
  rtaDbMin: number | undefined,
  rtaDbMax: number | undefined,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.width / dpr
  const height = canvas.height / dpr
  if (width === 0 || height === 0) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const padding = calcPadding(width, height)
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const scaledFontSize = Math.max(9, Math.min(16, Math.round(width * 0.01)))
  const fontSize = Math.round((graphFontSize + scaledFontSize) / 2)

  const range: DbRange = {
    dbMin: rtaDbMin ?? CANVAS_SETTINGS.RTA_DB_MIN,
    dbMax: rtaDbMax ?? CANVAS_SETTINGS.RTA_DB_MAX,
    freqMin: CANVAS_SETTINGS.RTA_FREQ_MIN,
    freqMax: CANVAS_SETTINGS.RTA_FREQ_MAX,
  }

  ctx.save()
  ctx.translate(padding.left, padding.top)

  drawGrid(ctx, plotWidth, plotHeight, range)

  // Draw fake spectrum fill + stroke using PLACEHOLDER_CURVE
  const gradient = ctx.createLinearGradient(0, 0, 0, plotHeight)
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.85)')
  gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.35)')
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)')

  const strokePath = new Path2D()
  const fillPath = new Path2D()
  let started = false
  let lastX = 0

  for (const [freq, db] of PLACEHOLDER_CURVE) {
    if (freq < range.freqMin || freq > range.freqMax) continue
    const x = freqToLogPosition(freq, range.freqMin, range.freqMax) * plotWidth
    const y = ((range.dbMax - clamp(db, range.dbMin, range.dbMax)) / (range.dbMax - range.dbMin)) * plotHeight

    if (!started) {
      strokePath.moveTo(x, y)
      fillPath.moveTo(x, plotHeight)
      fillPath.lineTo(x, y)
      started = true
    } else {
      strokePath.lineTo(x, y)
      fillPath.lineTo(x, y)
    }
    lastX = x
  }

  fillPath.lineTo(lastX, plotHeight)
  fillPath.closePath()

  ctx.fillStyle = gradient
  ctx.fill(fillPath)

  ctx.strokeStyle = VIZ_COLORS.SPECTRUM
  ctx.globalAlpha = 0.15
  ctx.lineWidth = 3.5
  ctx.stroke(strokePath)
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.5
  ctx.stroke(strokePath)

  ctx.restore()

  drawAxisLabels(ctx, padding, plotWidth, plotHeight, range, fontSize, width, height)
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface SpectrumCanvasProps {
  spectrumRef: React.RefObject<SpectrumData | null>
  advisories: Advisory[]  // Keep as prop — changes infrequently, drives markers
  isRunning: boolean
  error?: string | null
  graphFontSize?: number
  onStart?: () => void
  earlyWarning?: EarlyWarning | null
  rtaDbMin?: number
  rtaDbMax?: number
  spectrumLineWidth?: number
  clearedIds?: Set<string>
  minFrequency?: number
  maxFrequency?: number
  onFreqRangeChange?: (min: number, max: number) => void
  showThresholdLine?: boolean
  feedbackThresholdDb?: number
  isFrozen?: boolean
  canvasTargetFps?: number
}

const FREQ_LABELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

const GRAB_THRESHOLD_PX = 22 // 44px total touch target per line

export const SpectrumCanvas = memo(function SpectrumCanvas({ spectrumRef, advisories, isRunning, error, graphFontSize = 11, onStart, earlyWarning, rtaDbMin: rtaDbMinProp, rtaDbMax: rtaDbMaxProp, spectrumLineWidth: spectrumLineWidthProp, clearedIds, minFrequency = 20, maxFrequency = 20000, onFreqRangeChange, showThresholdLine = false, feedbackThresholdDb, isFrozen = false, canvasTargetFps }: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dimensionsRef = useRef({ width: 0, height: 0 })
  const advisoriesRef = useRef(advisories)
  advisoriesRef.current = advisories
  const clearedIdsRef = useRef(clearedIds)
  clearedIdsRef.current = clearedIds

  // Freq range ref for 60fps reads during drag (avoids React re-renders)
  const freqRangeRef = useRef({ min: minFrequency, max: maxFrequency })
  useEffect(() => {
    freqRangeRef.current = { min: minFrequency, max: maxFrequency }
  }, [minFrequency, maxFrequency])


  // Drag state
  const dragRef = useRef<'min' | 'max' | null>(null)
  const paddingRef = useRef({ left: 0, top: 0, plotWidth: 0, plotHeight: 0 })
  const onFreqRangeChangeRef = useRef(onFreqRangeChange)
  onFreqRangeChangeRef.current = onFreqRangeChange

  // Freeze: snapshot spectrum data so canvas holds a moment while analysis continues
  const isFrozenRef = useRef(false)
  const frozenSpectrumRef = useRef<SpectrumData | null>(null)

  useEffect(() => {
    isFrozenRef.current = isFrozen
    if (isFrozen && spectrumRef.current) {
      // Deep-copy Float32Arrays — analyzer overwrites the same buffer each frame
      frozenSpectrumRef.current = {
        ...spectrumRef.current,
        freqDb: new Float32Array(spectrumRef.current.freqDb),
        power: new Float32Array(spectrumRef.current.power),
      }
    } else {
      frozenSpectrumRef.current = null
    }
    dirtyRef.current = true
  }, [isFrozen, spectrumRef])

  // Cached per-frame objects — avoid recreating every frame
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const gradientRef = useRef<CanvasGradient | null>(null)
  const gradientHeightRef = useRef(0)
  const peakHoldRef = useRef<Float32Array | null>(null)

  // Hover tooltip: track mouse position for freq+dB readout (null = not hovering)
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null)

  // Dirty-bit: skip canvas redraw when nothing has changed
  const lastSpectrumRef = useRef<SpectrumData | null>(null)
  const dirtyRef = useRef(true) // Start dirty to ensure first frame draws

  // Track whether analysis has ever started; once true the placeholder is gone for good
  const [hasEverStarted, setHasEverStarted] = useState(false)
  useEffect(() => {
    if (isRunning) setHasEverStarted(true)
  }, [isRunning])

  const showPlaceholder = !hasEverStarted

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        dimensionsRef.current = { width, height }

        const dpr = window.devicePixelRatio || 1
        dprRef.current = dpr

        // Invalidate cached objects on resize (canvas element may change)
        ctxRef.current = null
        gradientRef.current = null
        dirtyRef.current = true

        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = Math.floor(width * dpr)
          canvas.height = Math.floor(height * dpr)
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`

          // Redraw placeholder on resize (before analysis starts)
          if (!hasEverStarted) {
            drawPlaceholder(canvas, graphFontSize, rtaDbMinProp, rtaDbMaxProp)
          }
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEverStarted])

  const render = useCallback(() => {
    const spectrum = isFrozenRef.current ? frozenSpectrumRef.current : spectrumRef.current

    // Dirty check: skip frame if nothing changed since last draw
    const spectrumChanged = spectrum !== lastSpectrumRef.current
    if (!spectrumChanged && !dirtyRef.current) return
    lastSpectrumRef.current = spectrum
    dirtyRef.current = false // eslint-disable-line react-hooks/immutability -- rAF dirty-bit optimization

    const canvas = canvasRef.current
    if (!canvas) return

    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d')
    const ctx = ctxRef.current
    if (!ctx) return

    const dpr = dprRef.current
    const { width, height } = dimensionsRef.current
    if (width === 0 || height === 0) return

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const padding = calcPadding(width, height)
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    // Scale font size proportionally to canvas width, clamped to readable range
    const scaledFontSize = Math.max(10, Math.min(16, Math.round(width * 0.015)))
    const fontSize = Math.round((graphFontSize + scaledFontSize) / 2)
    const peakMarkerRadius = Math.max(4, Math.round(width * 0.005))

    const range: DbRange = {
      dbMin: rtaDbMinProp ?? CANVAS_SETTINGS.RTA_DB_MIN,
      dbMax: rtaDbMaxProp ?? CANVAS_SETTINGS.RTA_DB_MAX,
      freqMin: CANVAS_SETTINGS.RTA_FREQ_MIN,
      freqMax: CANVAS_SETTINGS.RTA_FREQ_MAX,
    }

    // ── Draw phases ──────────────────────────────────────────────
    ctx.save()
    ctx.translate(padding.left, padding.top)

    drawGrid(ctx, plotWidth, plotHeight, range)
    drawIndicatorLines(ctx, plotWidth, plotHeight, range, spectrum, showThresholdLine, feedbackThresholdDb, fontSize)
    drawSpectrum(ctx, plotWidth, plotHeight, range, spectrum, gradientRef, gradientHeightRef, spectrumLineWidthProp ?? 1.5, peakHoldRef)

    // Store padding for pointer event calculations
    paddingRef.current = { left: padding.left, top: padding.top, plotWidth, plotHeight }

    drawFreqRangeOverlay(ctx, plotWidth, plotHeight, range, freqRangeRef.current)
    drawMarkers(ctx, plotWidth, plotHeight, range, earlyWarning, advisoriesRef.current, clearedIdsRef.current, peakMarkerRadius, fontSize)

    // Frozen badge — top-right of plot area
    if (isFrozenRef.current) {
      const badgeText = 'FROZEN'
      ctx.font = `bold ${fontSize}px monospace`
      const tw = ctx.measureText(badgeText).width
      const bx = plotWidth - tw - 16
      const by = 6
      const px = 6, py = 3

      ctx.fillStyle = 'rgba(59,130,246,0.2)'
      ctx.beginPath()
      ctx.roundRect(bx - px, by, tw + px * 2, fontSize + py * 2, 3)
      ctx.fill()
      ctx.strokeStyle = 'rgba(59,130,246,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#60a5fa'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(badgeText, bx, by + py)
    }

    // Hover tooltip — freq + dB readout at cursor position
    const hover = hoverPosRef.current
    if (hover && !dragRef.current) {
      const hPos = clamp(hover.x / plotWidth, 0, 1)
      const hoverFreq = logPositionToFreq(hPos, range.freqMin, range.freqMax)
      const hoverDb = range.dbMax - (hover.y / plotHeight) * (range.dbMax - range.dbMin)

      const freqStr = formatFrequency(hoverFreq)
      const dbStr = `${Math.round(hoverDb)} dB`
      const label = `${freqStr}  ${dbStr}`

      ctx.font = `bold ${fontSize - 1}px monospace`
      const tw = ctx.measureText(label).width
      const tipPad = 6
      const tipH = fontSize + tipPad * 2
      const tipW = tw + tipPad * 2

      // Position tooltip near cursor, flip if near edges
      let tipX = hover.x + 12
      let tipY = hover.y - tipH - 4
      if (tipX + tipW > plotWidth) tipX = hover.x - tipW - 12
      if (tipY < 0) tipY = hover.y + 16

      // Background pill
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.beginPath()
      ctx.roundRect(tipX, tipY, tipW, tipH, 4)
      ctx.fill()

      // Text
      ctx.fillStyle = '#e5e5e5'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(label, tipX + tipPad, tipY + tipPad)

      // Crosshair lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(hover.x, 0)
      ctx.lineTo(hover.x, plotHeight)
      ctx.moveTo(0, hover.y)
      ctx.lineTo(plotWidth, hover.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()

    drawAxisLabels(ctx, padding, plotWidth, plotHeight, range, fontSize, width, height)

  }, [spectrumRef, graphFontSize, earlyWarning, rtaDbMinProp, rtaDbMaxProp, spectrumLineWidthProp, showThresholdLine, feedbackThresholdDb])

  useAnimationFrame(render, isRunning || hasEverStarted, canvasTargetFps)

  // Mark dirty when display props change (triggers redraw on next rAF tick)
  // eslint-disable-next-line react-hooks/immutability -- rAF dirty-bit optimization
  useEffect(() => { dirtyRef.current = true }, [graphFontSize, earlyWarning, rtaDbMinProp, rtaDbMaxProp, spectrumLineWidthProp, showThresholdLine, feedbackThresholdDb])
  // eslint-disable-next-line react-hooks/immutability -- rAF dirty-bit optimization
  useEffect(() => { dirtyRef.current = true }, [advisories, clearedIds])

  // Pointer event handlers for dragging frequency range lines
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onFreqRangeChange) return

    const { RTA_FREQ_MIN, RTA_FREQ_MAX } = CANVAS_SETTINGS

    function clientXToFreq(clientX: number): number {
      const rect = canvas!.getBoundingClientRect()
      const { left: padLeft, plotWidth } = paddingRef.current
      const canvasX = clientX - rect.left - padLeft
      const pos = clamp(canvasX / plotWidth, 0, 1)
      return roundFreqToNice(logPositionToFreq(pos, RTA_FREQ_MIN, RTA_FREQ_MAX))
    }

    function getLineDistances(clientX: number): { minDist: number; maxDist: number } {
      const rect = canvas!.getBoundingClientRect()
      const { left: padLeft, plotWidth } = paddingRef.current
      const canvasX = clientX - rect.left - padLeft
      const minX = freqToLogPosition(freqRangeRef.current.min, RTA_FREQ_MIN, RTA_FREQ_MAX) * plotWidth
      const maxX = freqToLogPosition(freqRangeRef.current.max, RTA_FREQ_MIN, RTA_FREQ_MAX) * plotWidth
      return { minDist: Math.abs(canvasX - minX), maxDist: Math.abs(canvasX - maxX) }
    }

    function onPointerDown(e: PointerEvent) {
      const { minDist, maxDist } = getLineDistances(e.clientX)
      const closest = minDist <= maxDist ? 'min' : 'max'
      const dist = Math.min(minDist, maxDist)

      if (dist > GRAB_THRESHOLD_PX) return

      e.preventDefault()
      dragRef.current = closest
      canvas!.setPointerCapture(e.pointerId)
      canvas!.style.cursor = 'ew-resize'
    }

    function onPointerMove(e: PointerEvent) {
      if (dragRef.current) {
        const hz = clientXToFreq(e.clientX)
        const range = freqRangeRef.current
        dirtyRef.current = true // Force redraw during drag

        if (dragRef.current === 'min') {
          const newMin = Math.min(hz, range.max - 50)
          freqRangeRef.current = { min: newMin, max: range.max }
          onFreqRangeChangeRef.current?.(newMin, range.max)
        } else {
          const newMax = Math.max(hz, range.min + 50)
          freqRangeRef.current = { min: range.min, max: newMax }
          onFreqRangeChangeRef.current?.(range.min, newMax)
        }
      } else {
        // Hover cursor change
        const { minDist, maxDist } = getLineDistances(e.clientX)
        const nearLine = Math.min(minDist, maxDist) <= GRAB_THRESHOLD_PX
        canvas!.style.cursor = nearLine ? 'ew-resize' : 'default'
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (dragRef.current) {
        dragRef.current = null
        canvas!.releasePointerCapture(e.pointerId)
        canvas!.style.cursor = 'default'
      }
    }

    function onPointerCancel(e: PointerEvent) {
      if (dragRef.current) {
        dragRef.current = null
        canvas!.releasePointerCapture(e.pointerId)
        canvas!.style.cursor = 'default'
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [onFreqRangeChange])

  // Hover tooltip: mousemove/mouseleave to track cursor for freq+dB readout
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Skip hover tooltip on touch-primary devices (interferes with touch interactions)
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return

    function onMouseMove(e: MouseEvent) {
      // Don't show tooltip while dragging freq range lines
      if (dragRef.current) {
        hoverPosRef.current = null
        return
      }
      const rect = canvas!.getBoundingClientRect()
      const { left: padLeft, top: padTop, plotWidth, plotHeight } = paddingRef.current
      const x = e.clientX - rect.left - padLeft
      const y = e.clientY - rect.top - padTop

      // Only show tooltip within the plot area
      if (x >= 0 && x <= plotWidth && y >= 0 && y <= plotHeight) {
        hoverPosRef.current = { x, y }
      } else {
        hoverPosRef.current = null
      }
      dirtyRef.current = true
    }

    function onMouseLeave() {
      hoverPosRef.current = null
      dirtyRef.current = true
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Keyboard handler for freq range adjustment (a11y: arrow keys)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!onFreqRangeChangeRef.current) return
    const step = 50 // Hz per keystroke
    const range = freqRangeRef.current

    // Arrow keys = low handle, Shift+Arrow = high handle
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? step : -step

      if (e.shiftKey) {
        const newMax = clamp(range.max + delta, range.min + step, CANVAS_SETTINGS.RTA_FREQ_MAX)
        freqRangeRef.current = { min: range.min, max: newMax }
        onFreqRangeChangeRef.current(range.min, newMax)
      } else {
        const newMin = clamp(range.min + delta, CANVAS_SETTINGS.RTA_FREQ_MIN, range.max - step)
        freqRangeRef.current = { min: newMin, max: range.max }
        onFreqRangeChangeRef.current(newMin, range.max)
      }
      dirtyRef.current = true
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
      tabIndex={onFreqRangeChange ? 0 : undefined}
      role={onFreqRangeChange ? 'slider' : undefined}
      aria-label={onFreqRangeChange ? 'Frequency range selector' : undefined}
      aria-valuemin={onFreqRangeChange ? CANVAS_SETTINGS.RTA_FREQ_MIN : undefined}
      aria-valuemax={onFreqRangeChange ? CANVAS_SETTINGS.RTA_FREQ_MAX : undefined}
      aria-valuenow={onFreqRangeChange ? minFrequency : undefined}
      aria-valuetext={onFreqRangeChange ? `${minFrequency} Hz to ${maxFrequency} Hz` : undefined}
      onKeyDown={onFreqRangeChange ? handleKeyDown : undefined}
    >
      <canvas ref={canvasRef} className="w-full h-full" role="img" aria-label="Real-time audio frequency spectrum display" />
      {showPlaceholder && (
        <div className="absolute inset-0">
          <div
            className={`absolute inset-0 flex items-center justify-center ${onStart ? 'cursor-pointer' : 'pointer-events-none'}`}
            onClick={onStart}
            role={onStart ? 'button' : undefined}
            aria-label={onStart ? (error ? 'Retry analysis' : 'Start analysis') : undefined}
            tabIndex={onStart ? 0 : undefined}
            onKeyDown={onStart ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStart(); } } : undefined}
          >
            {error ? (
              <span className="flex flex-col items-center gap-1.5 px-5 py-3 rounded-md bg-black/70 backdrop-blur-sm pointer-events-none">
                <span className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                  </svg>
                  Mic unavailable
                </span>
                <span className="text-xs text-neutral-400">Tap to retry</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 px-4 py-2 rounded-md bg-black/60 text-sm text-neutral-300 font-medium tracking-wide backdrop-blur-sm pointer-events-none">
                Press
                {/* mini speaker button replica */}
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-primary/60 flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-primary/80" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.31-2.5-4.06v8.12c1.48-.75 2.5-2.29 2.5-4.06zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                </span>
                To Begin Analysis
              </span>
            )}
          </div>
        </div>
      )}
      {/* Error overlay for post-start failures (canvas shows stale data underneath) */}
      {!showPlaceholder && error && !isRunning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-sm text-xs text-destructive font-medium">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
            Mic error — see banner above
          </span>
        </div>
      )}
    </div>
  )
})
