'use client'

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, Radio } from 'lucide-react'
import { formatFrequency } from '@/lib/utils/pitchUtils'
import type { EarlyWarning } from '@/hooks/useAudioAnalyzer'

interface EarlyWarningPanelProps {
  earlyWarning: EarlyWarning | null
}

export const EarlyWarningPanel = memo(function EarlyWarningPanel({ earlyWarning }: EarlyWarningPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!earlyWarning || earlyWarning.predictedFrequencies.length === 0) return null

  const { predictedFrequencies, fundamentalSpacing, estimatedPathLength, confidence } = earlyWarning
  const confidencePct = Math.round(confidence * 100)

  return (
    <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 font-medium uppercase tracking-wide hover:bg-amber-500/10 transition-colors"
        aria-expanded={isExpanded}
      >
        <Radio className="w-3 h-3 animate-pulse" aria-hidden="true" />
        <span>Early Warning</span>
        <span className="ml-auto font-mono text-amber-400/70">{confidencePct}%</span>
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-amber-400/50" />
          : <ChevronRight className="w-3 h-3 text-amber-400/50" />
        }
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-2 space-y-1.5">
          {/* Predicted frequencies */}
          <div className="flex flex-wrap gap-1">
            {predictedFrequencies.slice(0, 6).map((freq) => (
              <span
                key={freq}
                className="text-xs font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-300 border border-amber-500/20"
              >
                {formatFrequency(freq)}
              </span>
            ))}
          </div>

          {/* Details row */}
          <div className="flex items-center gap-3 text-xs text-amber-400/60 font-mono">
            {fundamentalSpacing && (
              <span>Spacing: {fundamentalSpacing.toFixed(0)} Hz</span>
            )}
            {estimatedPathLength && (
              <span>Path: {estimatedPathLength.toFixed(1)} m</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
