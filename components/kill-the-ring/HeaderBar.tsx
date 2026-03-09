'use client'

import { memo } from 'react'
import { FeedbackHistoryPanel } from './FeedbackHistoryPanel'
import { HelpMenu } from './HelpMenu'
import { SettingsPanel } from './SettingsPanel'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutGrid, Maximize2, Mic, Minimize2, Pause, Play } from 'lucide-react'
import type { OperationMode, DetectorSettings } from '@/types/advisory'
import type { AudioDevice } from '@/hooks/useAudioDevices'

interface HeaderBarProps {
  isRunning: boolean
  start: () => void
  stop: () => void
  settings: DetectorSettings
  onSettingsChange: (s: Partial<DetectorSettings>) => void
  onModeChange: (mode: OperationMode) => void
  onReset: () => void
  resetLayout: () => void
  isFullscreen: boolean
  toggleFullscreen: () => void
  isFrozen: boolean
  toggleFreeze: () => void
  devices: AudioDevice[]
  selectedDeviceId: string
  onDeviceChange: (deviceId: string) => void
}

export const HeaderBar = memo(function HeaderBar({
  isRunning, start, stop,
  settings, onSettingsChange, onModeChange, onReset,
  resetLayout, isFullscreen, toggleFullscreen,
  isFrozen, toggleFreeze,
  devices, selectedDeviceId, onDeviceChange,
}: HeaderBarProps) {
  return (
    <header className="relative flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm sm:px-4 sm:py-2 sm:gap-4">

      {/* ── DESKTOP: Logo + button group (left side) ───────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-3 sm:flex-shrink-0">

        {/* Desktop-only: button inside logo group */}
        <div className="hidden sm:flex items-center gap-2.5 flex-shrink-0">
          <div className="relative">
            <button
              onClick={isRunning ? stop : start}
              aria-label={isRunning ? 'Stop analysis' : 'Start analysis'}
              className="relative w-12 h-12 flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
            >
              <div className={`absolute inset-1 rounded-full border-2 transition-colors duration-300 ${isRunning ? 'border-primary' : 'border-primary/50'}`} />
              {isRunning && (
                <div className="absolute inset-1 rounded-full border-2 border-primary animate-ping opacity-30" />
              )}
              <svg
                className={`size-6 relative z-10 transition-colors duration-300 ${isRunning ? 'text-primary' : 'text-primary/60 hover:text-primary'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.31-2.5-4.06v8.12c1.48-.75 2.5-2.29 2.5-4.06zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </button>
          </div>

          <div className="flex flex-col justify-center gap-[3px]">
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-lg font-black tracking-tight text-foreground">KILL THE</span>
              <span className="text-xl font-black tracking-tight text-primary">RING</span>
            </div>
            <span className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase leading-none">
              Don Wells AV{' '}
              <span className="font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}</span>
            </span>
          </div>
        </div>

        {/* Mobile-only: inline start button + wordmark */}
        <div className="flex sm:hidden items-center gap-2 min-w-0">
          <button
            onClick={isRunning ? stop : start}
            aria-label={isRunning ? 'Stop analysis' : 'Start analysis'}
            className="relative w-12 h-12 flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          >
            <div className={`absolute inset-1 rounded-full border-2 transition-colors duration-300 ${isRunning ? 'border-primary' : 'border-primary/50'}`} />
            {isRunning && (
              <div className="absolute inset-1 rounded-full border-2 border-primary animate-ping opacity-30" />
            )}
            <svg
              className={`size-6 relative z-10 transition-colors duration-300 ${isRunning ? 'text-primary' : 'text-primary/60 hover:text-primary'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.31-2.5-4.06v8.12c1.48-.75 2.5-2.29 2.5-4.06zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>
          <div className="flex flex-col justify-center gap-0 min-w-0">
            <div className="flex items-baseline gap-1 leading-none">
              <span className="text-base font-black tracking-tight text-foreground">KILL THE</span>
              <span className="text-lg font-black tracking-tight text-primary">RING</span>
            </div>
            <span className="text-[0.5625rem] font-semibold tracking-wider text-muted-foreground uppercase leading-none">
              Don Wells AV{' '}
              <span className="font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Action icons (right side) ──────────────────── */}
      <div className="flex items-center justify-end gap-2 sm:gap-2 sm:px-0 text-xs text-muted-foreground sm:flex-shrink-0">

        {/* Audio source selector */}
        {devices.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-foreground"
                    aria-label="Select audio input"
                  >
                    <Mic className="size-6" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Audio input
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="max-w-[280px]">
              <DropdownMenuRadioGroup value={selectedDeviceId} onValueChange={onDeviceChange}>
                <DropdownMenuRadioItem value="" className="text-xs">
                  Default (System)
                </DropdownMenuRadioItem>
                {devices.map(d => (
                  <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId} className="text-xs truncate">
                    {d.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetLayout}
              className="hidden landscape:flex h-10 w-10 text-muted-foreground hover:text-foreground"
              aria-label="Reset layout"
            >
              <LayoutGrid className="size-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Reset layout (L)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="hidden landscape:flex h-10 w-10 text-muted-foreground hover:text-foreground"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="size-6" /> : <Maximize2 className="size-6" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          </TooltipContent>
        </Tooltip>

        {isRunning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFreeze}
                className={`hidden landscape:flex h-10 w-10 ${
                  isFrozen ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label={isFrozen ? 'Unfreeze spectrum' : 'Freeze spectrum'}
                aria-pressed={isFrozen}
              >
                {isFrozen ? <Play className="size-6" /> : <Pause className="size-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isFrozen ? 'Unfreeze (P)' : 'Freeze display (P)'}
            </TooltipContent>
          </Tooltip>
        )}

        <FeedbackHistoryPanel />
        <HelpMenu />
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onModeChange={onModeChange}
          onReset={onReset}
        />
      </div>
    </header>
  )
})
