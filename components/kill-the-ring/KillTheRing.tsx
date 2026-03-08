'use client'

import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react'
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer'
import { useAudioDevices } from '@/hooks/useAudioDevices'
import { useAdvisoryLogging } from '@/hooks/useAdvisoryLogging'
import { useFullscreen } from '@/hooks/useFullscreen'
import { HeaderBar } from './HeaderBar'
import { MobileLayout } from './MobileLayout'
import { DesktopLayout } from './DesktopLayout'
import type { OperationMode } from '@/types/advisory'
import { OPERATION_MODES } from '@/lib/dsp/constants'
import type { ImperativePanelHandle } from 'react-resizable-panels'

type GraphView = 'rta' | 'geq' | 'controls'

const LAYOUT_PREFS_KEY = 'ktr-layout-prefs'

export const KillTheRing = memo(function KillTheRingComponent() {
  const {
    isRunning,
    error,
    noiseFloorDb,
    spectrumStatus,
    spectrumRef,
    advisories,
    earlyWarning,
    settings,
    start,
    stop,
    switchDevice,
    updateSettings,
    resetSettings,
  } = useAudioAnalyzer()

  const { devices, selectedDeviceId, setSelectedDeviceId } = useAudioDevices()

  const activeAdvisoryCount = useMemo(
    () => advisories.filter(a => !a.resolved).length,
    [advisories]
  )

  const [activeGraph, setActiveGraph] = useState<GraphView>('rta')
  const [bottomLeftGraph, setBottomLeftGraph] = useState<GraphView>('geq')
  const [bottomRightGraph, setBottomRightGraph] = useState<GraphView>('controls')
  const [mobileTab, setMobileTab] = useState<'issues' | 'graph' | 'settings'>('issues')
  const [activeSidebarTab, setActiveSidebarTab] = useState<'issues' | 'controls'>('controls')
  const [layoutKey, setLayoutKey] = useState(0)
  const [issuesPanelOpen, setIssuesPanelOpen] = useState(true)
  const [isFrozen, setIsFrozen] = useState(false)
  const toggleFreeze = useCallback(() => setIsFrozen(prev => !prev), [])
  const issuesPanelRef = useRef<ImperativePanelHandle>(null)

  // Force-collapse issues panel on mount to override localStorage-restored size
  useEffect(() => {
    requestAnimationFrame(() => issuesPanelRef.current?.collapse())
  }, [])

  // Fullscreen
  const rootRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef)

  // Wrap start to always pass the persisted device preference
  const startWithDevice = useCallback(() => {
    start({ deviceId: selectedDeviceId || undefined })
  }, [start, selectedDeviceId])

  // Auto-unfreeze when stopping analysis
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset UI state on stop
    if (!isRunning) setIsFrozen(false)
  }, [isRunning])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (isRunning) stop(); else startWithDevice()
          break
        case 'p': case 'P':
          if (!isRunning) return
          e.preventDefault()
          toggleFreeze()
          break
        case 'f': case 'F':
          e.preventDefault()
          toggleFullscreen()
          break
        case '1':
          e.preventDefault()
          setActiveGraph('rta')
          break
        case '2':
          e.preventDefault()
          setActiveGraph('geq')
          break
        case '3':
          e.preventDefault()
          setActiveGraph('controls')
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, toggleFreeze, startWithDevice, stop, toggleFullscreen])

  // Dismissed advisory IDs — hidden until the advisory disappears and a new one is detected
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }, [])

  const handleClearAllIssues = useCallback(() => {
    setDismissedIds(new Set(advisories.map(a => a.id)))
  }, [advisories])

  const handleClearResolvedIssues = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      advisories.forEach(a => { if (a.resolved) next.add(a.id) })
      return next
    })
  }, [advisories])

  // GEQ-specific cleared IDs — independent from issue card dismissals
  const [geqClearedIds, setGeqClearedIds] = useState<Set<string>>(new Set())

  const handleClearGEQ = useCallback(() => {
    setGeqClearedIds(new Set(advisories.map(a => a.id)))
  }, [advisories])

  // True when at least one advisory has a GEQ recommendation that hasn't been cleared
  const hasActiveGEQBars = useMemo(() =>
    advisories.some(a => !geqClearedIds.has(a.id) && a.advisory?.geq),
    [advisories, geqClearedIds]
  )

  // RTA-specific cleared IDs — independent from issue cards and GEQ
  const [rtaClearedIds, setRtaClearedIds] = useState<Set<string>>(new Set())

  const handleClearRTA = useCallback(() => {
    setRtaClearedIds(new Set(advisories.map(a => a.id)))
  }, [advisories])

  // True when at least one advisory hasn't been cleared from the RTA
  const hasActiveRTAMarkers = useMemo(() =>
    advisories.some(a => !rtaClearedIds.has(a.id)),
    [advisories, rtaClearedIds]
  )

  // Auto-expire dismissed/cleared IDs once the advisory is no longer in the live list
  useEffect(() => {
    if (dismissedIds.size === 0 && geqClearedIds.size === 0 && rtaClearedIds.size === 0) return
    const liveIds = new Set(advisories.map((a) => a.id))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: prune stale IDs when advisories change
    setDismissedIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => { if (liveIds.has(id)) next.add(id) })
      return next.size === prev.size ? prev : next
    })
    setGeqClearedIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => { if (liveIds.has(id)) next.add(id) })
      return next.size === prev.size ? prev : next
    })
    setRtaClearedIds((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => { if (liveIds.has(id)) next.add(id) })
      return next.size === prev.size ? prev : next
    })
  }, [advisories, dismissedIds.size, geqClearedIds.size, rtaClearedIds.size])


  // Auto music-aware: watch spectrumStatus.peak vs noise floor
  const autoMusicDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!settings.autoMusicAware || !isRunning) return
    const peak = spectrumStatus?.peak ?? -100
    const floor = noiseFloorDb ?? -80
    const hysteresis = settings.autoMusicAwareHysteresisDb ?? 15
    const shouldBeMusic = peak > floor + hysteresis
    const isCurrentlyMusic = settings.musicAware

    if (shouldBeMusic === isCurrentlyMusic) return
    if (autoMusicDebounceRef.current) clearTimeout(autoMusicDebounceRef.current)
    autoMusicDebounceRef.current = setTimeout(() => {
      updateSettings({ musicAware: shouldBeMusic })
    }, 1000) // 1s debounce to avoid flapping

    return () => {
      if (autoMusicDebounceRef.current) clearTimeout(autoMusicDebounceRef.current)
    }
  }, [spectrumStatus?.peak, noiseFloorDb, settings.autoMusicAware, settings.musicAware, settings.autoMusicAwareHysteresisDb, isRunning, updateSettings])

  useAdvisoryLogging(advisories)

  // Load saved graph assignments from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_PREFS_KEY) ?? '{}')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: restore saved layout on mount
      if (saved.activeGraph) setActiveGraph(saved.activeGraph)
      if (saved.bottomLeftGraph) setBottomLeftGraph(saved.bottomLeftGraph)
      if (saved.bottomRightGraph) setBottomRightGraph(saved.bottomRightGraph)
    } catch {}
  }, [])

  // Persist graph assignments on change
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({
        activeGraph, bottomLeftGraph, bottomRightGraph,
      }))
    } catch {}
  }, [activeGraph, bottomLeftGraph, bottomRightGraph])

  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem('react-resizable-panels:ktr-layout-main')
      localStorage.removeItem('react-resizable-panels:ktr-layout-main-v2')
      localStorage.removeItem('react-resizable-panels:ktr-layout-main-v3')
      localStorage.removeItem('react-resizable-panels:ktr-layout-vertical')
      localStorage.removeItem('react-resizable-panels:ktr-layout-bottom')
      localStorage.removeItem(LAYOUT_PREFS_KEY)
    } catch {}
    setActiveGraph('rta')
    setBottomLeftGraph('geq')
    setBottomRightGraph('controls')
    setIssuesPanelOpen(false)
    setLayoutKey(k => k + 1)
  }, [])

  const openIssuesPanel = useCallback(() => {
    setIssuesPanelOpen(true)
    if (activeSidebarTab === 'issues') setActiveSidebarTab('controls')
    requestAnimationFrame(() => issuesPanelRef.current?.resize(25))
  }, [activeSidebarTab])

  const closeIssuesPanel = useCallback(() => {
    issuesPanelRef.current?.collapse()
  }, [])

  const handleModeChange = useCallback((mode: OperationMode) => {
    const preset = OPERATION_MODES[mode]
    if (!preset) return
    updateSettings({
      mode,
      feedbackThresholdDb: preset.feedbackThresholdDb,
      ringThresholdDb: preset.ringThresholdDb,
      growthRateThreshold: preset.growthRateThreshold,
      musicAware: preset.musicAware,
      autoMusicAware: preset.autoMusicAware,
      fftSize: preset.fftSize,
      minFrequency: preset.minFrequency,
      maxFrequency: preset.maxFrequency,
      sustainMs: preset.sustainMs,
      clearMs: preset.clearMs,
      holdTimeMs: preset.holdTimeMs,
      confidenceThreshold: preset.confidenceThreshold,
      prominenceDb: preset.prominenceDb,
      relativeThresholdDb: preset.relativeThresholdDb,
      eqPreset: preset.eqPreset,
      aWeightingEnabled: preset.aWeightingEnabled,
      inputGainDb: preset.inputGainDb,
      ignoreWhistle: preset.ignoreWhistle,
    })
  }, [updateSettings])

  const handleSettingsChange = useCallback((newSettings: Partial<typeof settings>) => {
    updateSettings(newSettings)
  }, [updateSettings])

  const handleFreqRangeChange = useCallback((min: number, max: number) => {
    updateSettings({ minFrequency: min, maxFrequency: max })
  }, [updateSettings])

  const handleDeviceChange = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    switchDevice(deviceId)
  }, [setSelectedDeviceId, switchDevice])

  const inputLevel = spectrumStatus?.peak ?? -60
  const autoGainDb = spectrumStatus?.autoGainDb
  const isAutoGain = spectrumStatus?.autoGainEnabled ?? settings.autoGainEnabled
  const isAutoGainLocked = spectrumStatus?.autoGainLocked ?? false

  return (
    <div ref={rootRef} className="flex flex-col h-screen bg-background">
      <HeaderBar
        isRunning={isRunning}
        start={startWithDevice}
        stop={stop}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onModeChange={handleModeChange}
        onReset={resetSettings}
        noiseFloorDb={noiseFloorDb}
        inputLevel={inputLevel}
        isAutoGain={isAutoGain}
        autoGainDb={autoGainDb}
        autoGainLocked={isAutoGainLocked}
        resetLayout={resetLayout}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isFrozen={isFrozen}
        toggleFreeze={toggleFreeze}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={handleDeviceChange}
      />

      {error && (
        <div className="px-4 py-1.5 bg-destructive/10 border-b border-destructive/20">
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}

      <MobileLayout
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        isRunning={isRunning}
        start={startWithDevice}
        isFrozen={isFrozen}
        toggleFreeze={toggleFreeze}
        advisories={advisories}
        activeAdvisoryCount={activeAdvisoryCount}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onModeChange={handleModeChange}
        onReset={resetSettings}
        dismissedIds={dismissedIds}
        onDismiss={handleDismiss}
        onClearAll={handleClearAllIssues}
        onClearResolved={handleClearResolvedIssues}
        spectrumRef={spectrumRef}
        earlyWarning={earlyWarning}
        inputLevel={inputLevel}
        isAutoGain={isAutoGain}
        autoGainDb={autoGainDb}
        autoGainLocked={isAutoGainLocked}
        rtaClearedIds={rtaClearedIds}
        geqClearedIds={geqClearedIds}
        hasActiveRTAMarkers={hasActiveRTAMarkers}
        hasActiveGEQBars={hasActiveGEQBars}
        onClearRTA={handleClearRTA}
        onClearGEQ={handleClearGEQ}
        onFreqRangeChange={handleFreqRangeChange}
      />

      <DesktopLayout
        layoutKey={layoutKey}
        isRunning={isRunning}
        start={startWithDevice}
        isFrozen={isFrozen}
        toggleFreeze={toggleFreeze}
        advisories={advisories}
        activeAdvisoryCount={activeAdvisoryCount}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onModeChange={handleModeChange}
        spectrumRef={spectrumRef}
        spectrumStatus={spectrumStatus}
        earlyWarning={earlyWarning}
        noiseFloorDb={noiseFloorDb}
        dismissedIds={dismissedIds}
        onDismiss={handleDismiss}
        onClearAll={handleClearAllIssues}
        activeGraph={activeGraph}
        setActiveGraph={setActiveGraph}
        bottomLeftGraph={bottomLeftGraph}
        setBottomLeftGraph={setBottomLeftGraph}
        issuesPanelOpen={issuesPanelOpen}
        issuesPanelRef={issuesPanelRef}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        openIssuesPanel={openIssuesPanel}
        closeIssuesPanel={closeIssuesPanel}
        setIssuesPanelOpen={setIssuesPanelOpen}
        rtaClearedIds={rtaClearedIds}
        geqClearedIds={geqClearedIds}
        hasActiveRTAMarkers={hasActiveRTAMarkers}
        hasActiveGEQBars={hasActiveGEQBars}
        onClearRTA={handleClearRTA}
        onClearGEQ={handleClearGEQ}
        onFreqRangeChange={handleFreqRangeChange}
      />
    </div>
  )
})
