'use client'

// Help menu for Kill The Ring application
// Updated with advanced algorithm documentation from DAFx-16, DBX, and KU Leuven research
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpCircle } from 'lucide-react'

export function HelpMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button suppressHydrationWarning variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" aria-label="Help">
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-lg">Kill The Ring Help</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 mb-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="modes">Modes</TabsTrigger>
            <TabsTrigger value="algorithms">Algorithms</TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="troubleshoot">Troubleshoot</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="math">The Math</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <Section title="What is Kill The Ring?">
              <p>
                Kill The Ring is a real-time acoustic feedback detection and analysis tool for professional live sound engineers.
                It uses multiple detection algorithms based on peer-reviewed acoustic research to identify feedback frequencies, 
                resonant rings, and problematic tones with high accuracy and minimal false positives.
              </p>
              <p className="mt-2">
                The system provides specific EQ recommendations and tracks algorithm confidence scores to help you make 
                informed decisions during live events.
              </p>
            </Section>

            <Section title="Quick Start">
              <ol className="list-decimal list-inside space-y-2">
                <li>Click the flashing <strong>START</strong> speaker button in the header to begin monitoring</li>
                <li>Detected issues appear in the <strong>Active Issues</strong> sidebar, sorted by frequency</li>
                <li>Each issue card shows frequency, pitch, severity, and recommended GEQ/PEQ cuts</li>
                <li>Tap <strong>Apply</strong> on a card to log the cut to the <strong>EQ Notepad</strong> tab</li>
                <li>Use the <strong>Algo</strong> tab in Settings to tune advanced detection algorithms</li>
                <li>Enable <strong>Show Algorithm Scores</strong> to see real-time MSD, Phase, and Compression status</li>
                <li>Export session logs for post-event analysis</li>
              </ol>
            </Section>

            <Section title="Key Features">
              <ul className="space-y-2">
                <li><strong>Multi-Algorithm Detection:</strong> MSD, Phase Coherence, Spectral Flatness, and Comb Pattern analysis working together</li>
                <li><strong>Compression Detection:</strong> Automatically adapts thresholds for dynamically compressed content</li>
                <li><strong>Content-Aware:</strong> Detects speech vs music vs compressed audio and adjusts sensitivity</li>
                <li><strong>Comb Pattern Prediction:</strong> Identifies feedback acoustic paths and predicts future feedback frequencies</li>
                <li><strong>Real-Time Algorithm Status:</strong> See exactly what each algorithm is detecting</li>
              </ul>
            </Section>

            <Section title="Display Areas">
              <ul className="space-y-2">
                <li><strong>Large Panel (top):</strong> Selected graph enlarged for detail. Switch between RTA Spectrum, 31-Band GEQ, and Controls.</li>
                <li><strong>Small Panels (bottom row):</strong> Two configurable panels - choose RTA, GEQ, or Controls for each.</li>
                <li><strong>Left Sidebar - Issues tab:</strong> Active detected issues with Apply buttons. RUNAWAY issues pulse red.</li>
                <li><strong>Left Sidebar - EQ Notepad tab:</strong> Accumulates applied cuts for easy reference and export.</li>
                <li><strong>Algorithm Status Bar:</strong> Shows current algorithm mode, content type, MSD buffer status, and compression detection (enable in Settings).</li>
              </ul>
            </Section>
          </TabsContent>

          {/* CONTROLS */}
          <TabsContent value="controls" className="mt-4 space-y-4">
            <Section title="Header Controls">
              <ul className="space-y-3">
                <li>
                  <strong>Start / Stop (Speaker Button):</strong> Begin or pause audio analysis. The LIVE indicator appears while running.
                </li>
                <li>
                  <strong>Input Gain (meter slider):</strong> Digital boost applied before analysis (-40 to +40 dB, default +15 dB). Increase if feedback is not being detected; reduce if clipping.
                </li>
                <li>
                  <strong>Mode:</strong> Detection sensitivity preset. Default is <strong>Feedback Hunt</strong>.
                </li>
                <li>
                  <strong>Logs / Sessions / Settings:</strong> Access session data, history, and configuration.
                </li>
              </ul>
            </Section>

            <Section title="Sidebar - Detection Controls">
              <p className="mb-2">Primary real-time tuning tools in the left sidebar:</p>
              <ul className="space-y-2">
                <li><strong>Mode dropdown:</strong> Sets detection sensitivity preset.</li>
                <li><strong>Freq Range chips:</strong> Four presets - Vocal (200-8kHz), Monitor (300-3kHz), Full (20-20kHz), Sub (20-250Hz).</li>
                <li><strong>Auto Music-Aware toggle:</strong> Automatically switches sensitivity when the band starts/stops playing.</li>
                <li><strong>Threshold:</strong> Primary sensitivity (4-8 dB aggressive, 10-14 dB balanced, 16+ dB conservative).</li>
                <li><strong>Ring:</strong> Resonance detection sensitivity (2-4 dB calibration, 5-7 dB normal, 8+ dB shows).</li>
                <li><strong>Growth:</strong> Amplitude growth rate threshold (0.5-1 dB/s catches early, 3+ dB/s only runaway).</li>
              </ul>
            </Section>

            <Section title="Settings Panel Tabs">
              <ul className="space-y-2">
                <li><strong>Analysis tab:</strong> FFT Size, Spectrum Smoothing, Hold Time, Confidence Threshold, Room Acoustics.</li>
                <li><strong>Algo tab:</strong> Algorithm Mode, MSD History Buffer, Phase Coherence Threshold, Fusion Threshold, Compression Detection, Comb Pattern Detection, Algorithm Score Display.</li>
                <li><strong>Display tab:</strong> Max Issues Shown, Graph Label Size, EQ Recommendation Style.</li>
                <li><strong>Export tab:</strong> Session log export in CSV, JSON, or plain text formats.</li>
              </ul>
            </Section>

            <Section title="EQ Recommendations">
              <ul className="space-y-2">
                <li><strong>GEQ:</strong> Nearest ISO 31-band center frequency with suggested cut depth.</li>
                <li><strong>PEQ:</strong> Precise frequency, Q value, and gain for parametric EQ.</li>
                <li><strong>EQ Style:</strong> Surgical (narrow Q, deep cuts) vs Heavy (wide Q, moderate cuts).</li>
              </ul>
            </Section>
          </TabsContent>

          {/* MODES */}
          <TabsContent value="modes" className="mt-4 space-y-4">
            <Section title="Operation Modes">
              <ul className="space-y-3">
                <li>
                  <strong>Feedback Hunt (Default):</strong> Balanced PA mode. Threshold 8 dB, Ring 4 dB, Growth 1.5 dB/s. Good general sensitivity with fewer false positives.
                </li>
                <li>
                  <strong>Aggressive:</strong> Maximum sensitivity for system calibration. Threshold 6 dB, Ring 3 dB, Growth 1 dB/s.
                </li>
                <li>
                  <strong>Vocal Ring:</strong> Tuned for speech frequencies (200 Hz-8 kHz). Threshold 6 dB, Ring 4 dB, Growth 1.5 dB/s.
                </li>
                <li>
                  <strong>Music-Aware:</strong> Reduced sensitivity for performance. Threshold 12 dB, Ring 5 dB, Growth 3 dB/s, music filter enabled.
                </li>
                <li>
                  <strong>Calibration:</strong> Ultra-sensitive for initial setup. Threshold 4 dB, Ring 4 dB, Growth 0.5 dB/s.
                </li>
              </ul>
            </Section>

            <Section title="Auto Music-Aware">
              <p className="mb-2">
                The <strong>Auto Music-Aware</strong> toggle automatically switches sensitivity based on signal level:
              </p>
              <ul className="space-y-2">
                <li>When signal rises 15 dB above noise floor, enters music-aware mode</li>
                <li>When signal drops back, returns to base mode after 1 second</li>
                <li>A Speech/Music pill shows the current automatic state</li>
              </ul>
            </Section>

            <Section title="Choosing a Mode">
              <ul className="space-y-2">
                <li>Default / general soundcheck: <strong>Feedback Hunt</strong></li>
                <li>Initial system setup / ring-out: <strong>Calibration</strong> or <strong>Aggressive</strong></li>
                <li>Monitor tuning: <strong>Vocal Ring</strong></li>
                <li>During live performance: <strong>Music-Aware</strong> or enable <strong>Auto Music-Aware</strong></li>
              </ul>
            </Section>
          </TabsContent>

          {/* ALGORITHMS - NEW TAB */}
          <TabsContent value="algorithms" className="mt-4 space-y-4">
            <Section title="Advanced Detection System">
              <p>
                Kill The Ring uses multiple detection algorithms from peer-reviewed acoustic research. 
                Each algorithm detects different characteristics of feedback, and they vote together 
                for maximum accuracy and minimal false positives.
              </p>
            </Section>

            <Section title="MSD - Magnitude Slope Deviation">
              <p className="mb-2">
                From the <strong>DAFx-16 paper</strong>. The key insight: feedback amplitude grows 
                <strong> linearly in dB scale</strong> over time, meaning its second derivative is near zero.
              </p>
              <ul className="space-y-1">
                <li><strong>Speech accuracy:</strong> 100% with just 7 frames (~160ms)</li>
                <li><strong>Classical music:</strong> 100% with 13 frames (~300ms)</li>
                <li><strong>Rock/compressed:</strong> Requires compression detection assistance</li>
              </ul>
              <p className="mt-2 text-xs">
                Low MSD = likely feedback. High MSD = likely music (amplitude varies).
              </p>
            </Section>

            <Section title="Phase Coherence Analysis">
              <p className="mb-2">
                From <strong>Nyquist stability theory</strong>. True feedback maintains constant phase 
                relationships across consecutive frames because it's a pure regenerative tone. 
                Music has random phase variations.
              </p>
              <ul className="space-y-1">
                <li><strong>High coherence (&gt;0.85):</strong> Likely feedback (phase-locked)</li>
                <li><strong>Medium coherence (0.65-0.85):</strong> Uncertain</li>
                <li><strong>Low coherence (&lt;0.65):</strong> Likely music (random phase)</li>
              </ul>
            </Section>

            <Section title="Spectral Flatness + Kurtosis">
              <p className="mb-2">
                Feedback is a <strong>near-pure tone</strong> with very low spectral flatness around the 
                frequency. The amplitude distribution also has high kurtosis (very peaky, not gaussian).
              </p>
              <ul className="space-y-1">
                <li><strong>Spectral Flatness &lt;0.05:</strong> Pure tone (feedback)</li>
                <li><strong>Kurtosis &gt;10:</strong> Strongly peaked distribution</li>
                <li><strong>Combined:</strong> High confidence feedback indicator</li>
              </ul>
            </Section>

            <Section title="Comb Filter Pattern Detection">
              <p className="mb-2">
                From the <strong>DBX paper</strong>. Multiple feedback frequencies appear at 
                <strong> regular intervals</strong> due to the round-trip acoustic delay path.
              </p>
              <ul className="space-y-1">
                <li><strong>Frequency spacing:</strong> f_n = n * c / (2 * d) where d = path length</li>
                <li><strong>Pattern detection:</strong> Finds common frequency spacing between peaks</li>
                <li><strong>Prediction:</strong> Calculates where future feedback will occur</li>
              </ul>
              <p className="mt-2 text-xs">
                When a comb pattern is detected, the system can predict the next feedback frequencies 
                before they become audible.
              </p>
            </Section>

            <Section title="Compression Detection">
              <p className="mb-2">
                The DAFx-16 research found that <strong>dynamically compressed content</strong> (rock/pop music) 
                causes false positives because sustained notes look like early feedback. 
                Compression detection identifies this and adjusts thresholds.
              </p>
              <ul className="space-y-1">
                <li><strong>Crest Factor:</strong> Peak-to-RMS ratio. Normal: 12 dB. Compressed: &lt;6 dB</li>
                <li><strong>Dynamic Range:</strong> Normal: &gt;20 dB. Compressed: &lt;8 dB</li>
                <li><strong>Adaptation:</strong> When compressed content detected, phase coherence gets more weight</li>
              </ul>
            </Section>

            <Section title="Algorithm Fusion">
              <p className="mb-2">
                All algorithms vote together with content-aware weighting:
              </p>
              <ul className="space-y-1">
                <li><strong>Speech:</strong> MSD 45%, Phase 25%, Spectral 15%, Comb 5%, Legacy 10%</li>
                <li><strong>Music:</strong> MSD 20%, Phase 40%, Spectral 15%, Comb 10%, Legacy 15%</li>
                <li><strong>Compressed:</strong> MSD 15%, Phase 45%, Spectral 20%, Comb 10%, Legacy 10%</li>
              </ul>
              <p className="mt-2 text-xs">
                The system automatically detects content type and applies appropriate weights.
              </p>
            </Section>

            <Section title="Algorithm Settings (Algo Tab)">
              <ul className="space-y-2">
                <li><strong>Algorithm Mode:</strong> Auto, MSD Only, Phase Only, Combined (MSD+Phase), or All</li>
                <li><strong>MSD History Buffer:</strong> Number of frames (7-50). More = accurate but slower</li>
                <li><strong>Phase Coherence Threshold:</strong> 40-95%. Higher = stricter, fewer false positives</li>
                <li><strong>Fusion Feedback Threshold:</strong> 40-90%. Combined probability needed for positive detection</li>
                <li><strong>Compression Detection:</strong> Enable/disable adaptive threshold adjustment</li>
                <li><strong>Comb Pattern Detection:</strong> Enable/disable acoustic path identification</li>
              </ul>
            </Section>
          </TabsContent>

          {/* TIPS */}
          <TabsContent value="tips" className="mt-4 space-y-4">
            <Section title="Workflow Best Practices">
              <ol className="list-decimal list-inside space-y-2">
                <li>Start with <strong>Calibration</strong> mode during initial system setup</li>
                <li>Enable <strong>Show Algorithm Scores</strong> to see what each algorithm is detecting</li>
                <li>Watch the <strong>MSD frame count</strong> - wait for 15+ frames before trusting results</li>
                <li>If you see <strong>COMPRESSED</strong> in the status bar, phase coherence is most reliable</li>
                <li>Use <strong>Comb Pattern</strong> predictions to preemptively address upcoming feedback frequencies</li>
                <li>Switch to <strong>Feedback Hunt</strong> for general PA monitoring</li>
                <li>Enable <strong>Auto Music-Aware</strong> so sensitivity adjusts automatically during shows</li>
                <li>Apply cuts conservatively - start with 3 dB and increase only if needed</li>
              </ol>
            </Section>

            <Section title="Getting Better Results">
              <ul className="space-y-2">
                <li><strong>Position matters:</strong> Place your analysis mic where feedback occurs</li>
                <li><strong>Gain staging:</strong> Ensure signal is strong but not clipping (default +15 dB)</li>
                <li><strong>Increase MSD frames:</strong> For compressed music, try 30-50 frames</li>
                <li><strong>Lower Phase threshold:</strong> For noisy environments, try 65-70%</li>
                <li><strong>Watch Content Type:</strong> The auto-detected type tells you which algorithms are most reliable</li>
              </ul>
            </Section>

            <Section title="Understanding Algorithm Scores">
              <ul className="space-y-2">
                <li><strong>MSD HIGH:</strong> Second derivative near zero - strong feedback indicator</li>
                <li><strong>Phase LOCKED:</strong> Consistent phase relationship - strong feedback indicator</li>
                <li><strong>Spectral PURE:</strong> Very low flatness - single tone present</li>
                <li><strong>Comb PATTERN:</strong> Regular frequency spacing - feedback loop identified</li>
                <li><strong>COMPRESSED:</strong> Dynamic compression detected - phase is most reliable</li>
              </ul>
            </Section>

            <Section title="Common Feedback Frequency Ranges">
              <ul className="space-y-2">
                <li><strong>200-500 Hz:</strong> Muddy buildup, boxy vocals, room modes</li>
                <li><strong>500 Hz-1 kHz:</strong> Nasal/honky tones, vocal feedback zone</li>
                <li><strong>1-3 kHz:</strong> Presence/intelligibility range, harsh feedback</li>
                <li><strong>3-6 kHz:</strong> Sibilance, cymbal harshness, piercing feedback</li>
                <li><strong>6-8 kHz:</strong> Air/brightness, high-frequency ringing</li>
              </ul>
            </Section>
          </TabsContent>

          {/* TROUBLESHOOT */}
          <TabsContent value="troubleshoot" className="mt-4 space-y-4">
            <Section title="No Audio Input">
              <ul className="space-y-2">
                <li>Check browser microphone permissions (camera/mic icon in address bar)</li>
                <li>Ensure correct input device is selected in system audio settings</li>
                <li>Try refreshing the page and granting permissions again</li>
                <li>Microphone access requires HTTPS in most browsers</li>
              </ul>
            </Section>

            <Section title="Too Many False Positives">
              <ul className="space-y-2">
                <li>Switch to <strong>Music-Aware</strong> mode during performance</li>
                <li>In the <strong>Algo tab</strong>: Raise Phase Coherence Threshold to 80-85%</li>
                <li>In the <strong>Algo tab</strong>: Raise Fusion Feedback Threshold to 75-85%</li>
                <li>Increase <strong>MSD History Buffer</strong> to 30-50 frames for compressed music</li>
                <li>Enable <strong>Compression Detection</strong> for rock/pop content</li>
                <li>Raise <strong>Threshold</strong> in sidebar (try 10-14 dB)</li>
              </ul>
            </Section>

            <Section title="Missing Feedback Detection">
              <ul className="space-y-2">
                <li>Lower <strong>Threshold</strong> in sidebar (try 4-6 dB)</li>
                <li>Increase <strong>Input Gain</strong> if signal level is low</li>
                <li>Switch to <strong>Aggressive</strong> or <strong>Calibration</strong> mode</li>
                <li>In the <strong>Algo tab</strong>: Lower Phase Coherence Threshold to 60-65%</li>
                <li>In the <strong>Algo tab</strong>: Lower Fusion Feedback Threshold to 50-55%</li>
                <li>Increase <strong>FFT Size</strong> to 16384 for better low-frequency resolution</li>
              </ul>
            </Section>

            <Section title="Compressed Music False Positives">
              <p className="mb-2">
                Dynamically compressed music (rock, pop, EDM) can trigger false positives because 
                sustained notes have flat amplitude curves similar to early feedback.
              </p>
              <ul className="space-y-2">
                <li>Enable <strong>Compression Detection</strong> in the Algo tab</li>
                <li>Increase <strong>MSD History Buffer</strong> to 40-50 frames</li>
                <li>Watch the Algorithm Status Bar - when it shows COMPRESSED, phase coherence is most reliable</li>
                <li>Use <strong>Phase Only</strong> algorithm mode for heavily compressed content</li>
              </ul>
            </Section>

            <Section title="Slow or Laggy Display">
              <ul className="space-y-2">
                <li>Reduce <strong>FFT Size</strong> to 4096 in Settings</li>
                <li>Reduce <strong>MSD History Buffer</strong> to 15-20 frames</li>
                <li>Disable <strong>Show Algorithm Scores</strong> and <strong>Show Phase Display</strong></li>
                <li>Close other browser tabs to free CPU resources</li>
              </ul>
            </Section>
          </TabsContent>

          {/* TECHNICAL */}
          <TabsContent value="technical" className="mt-4 space-y-4">
            <Section title="Analysis Engine">
              <ul className="space-y-2">
                <li><strong>FFT Analysis:</strong> Fast Fourier Transform via Web Audio API. Default 8192 bins at 48 kHz = ~5.9 Hz resolution</li>
                <li><strong>Peak Detection:</strong> Local maxima exceeding adaptive noise floor and detection threshold</li>
                <li><strong>Track Persistence:</strong> Peaks tracked across frames to distinguish sustained feedback from transients (50 cents tolerance)</li>
                <li><strong>Harmonic Filtering:</strong> Suppresses harmonics (up to 8th) of detected fundamentals</li>
                <li><strong>Algorithm Fusion:</strong> MSD, Phase, Spectral, and Comb algorithms vote with content-aware weighting</li>
              </ul>
            </Section>

            <Section title="Default Configuration">
              <ul className="space-y-2">
                <li><strong>Mode:</strong> Feedback Hunt</li>
                <li><strong>Frequency range:</strong> 200 Hz - 8 kHz (vocal-focused)</li>
                <li><strong>Feedback threshold:</strong> 8 dB</li>
                <li><strong>Ring threshold:</strong> 4 dB</li>
                <li><strong>Growth rate:</strong> 1.5 dB/s</li>
                <li><strong>FFT size:</strong> 8192</li>
                <li><strong>Smoothing:</strong> 60%</li>
                <li><strong>Hold time:</strong> 3 s</li>
                <li><strong>Input gain:</strong> +15 dB</li>
                <li><strong>Confidence threshold:</strong> 40%</li>
                <li><strong>Algorithm mode:</strong> Combined (MSD + Phase)</li>
                <li><strong>MSD min frames:</strong> 15</li>
                <li><strong>Phase coherence threshold:</strong> 75%</li>
                <li><strong>Fusion feedback threshold:</strong> 65%</li>
              </ul>
            </Section>

            <Section title="Severity Levels">
              <ul className="space-y-2">
                <li><strong className="text-red-500">RUNAWAY:</strong> Active feedback rapidly increasing - address immediately</li>
                <li><strong className="text-orange-500">GROWING:</strong> Feedback building but not yet critical</li>
                <li><strong className="text-yellow-500">RESONANCE:</strong> Stable resonant peak that could become feedback</li>
                <li><strong className="text-purple-500">RING:</strong> Subtle ring that may need attention</li>
                <li><strong className="text-cyan-500">WHISTLE:</strong> Detected whistle or sibilance</li>
                <li><strong className="text-green-500">INSTRUMENT:</strong> Likely musical content, not feedback</li>
              </ul>
            </Section>

            <Section title="GEQ Band Mapping">
              <p className="mb-2">Detected frequencies map to nearest ISO 31-band center frequency:</p>
              <p className="text-xs font-mono bg-muted p-2 rounded leading-relaxed">
                20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1k, 1.25k, 1.6k, 2k, 2.5k, 3.15k, 4k, 5k, 6.3k, 8k, 10k, 12.5k, 16k, 20k Hz
              </p>
            </Section>

            <Section title="Browser Requirements">
              <ul className="space-y-2">
                <li><strong>Web Audio API + getUserMedia:</strong> Required for real-time audio processing</li>
                <li><strong>Supported:</strong> Chrome 74+, Firefox 76+, Safari 14.1+, Edge 79+</li>
                <li><strong>Sample rate:</strong> Uses system default (typically 44.1 kHz or 48 kHz)</li>
                <li><strong>HTTPS:</strong> Required for microphone access in production</li>
              </ul>
            </Section>
          </TabsContent>

          {/* THE MATH - Deep dive into algorithms */}
          <TabsContent value="math" className="mt-4 space-y-4">
            <Section title="FFT and Spectral Analysis">
              <p className="mb-2">
                The core analysis uses the <strong>Fast Fourier Transform</strong> to decompose audio into frequency bins:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p>Frequency resolution: <strong>df = fs / N</strong></p>
                <p>At 8192pt @ 48kHz: df = 48000 / 8192 = <strong>5.86 Hz/bin</strong></p>
                <p>Bin to Hz: <strong>f = bin * (fs / N)</strong></p>
              </div>
              <p className="mt-2 text-xs">
                Quadratic interpolation refines peak frequency beyond bin resolution (Grandke, 1983):
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p>d = 0.5 * (y[k-1] - y[k+1]) / (y[k-1] - 2*y[k] + y[k+1])</p>
                <p>True frequency: <strong>f_true = (k + d) * df</strong></p>
              </div>
            </Section>

            <Section title="MSD Algorithm (DAFx-16)">
              <p className="mb-2">
                The <strong>Magnitude Slope Deviation</strong> algorithm exploits the fact that feedback 
                grows exponentially, which appears <strong>linear in dB scale</strong>:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p>Feedback amplitude: A(t) = A0 * e^(a*t)</p>
                <p>In dB: L(t) = L0 + (20*a/ln(10)) * t <strong>(linear!)</strong></p>
                <p>Second derivative: <strong>d2L/dt2 = 0</strong> for feedback</p>
              </div>
              <p className="mt-2 text-xs">
                The MSD is calculated as the sum of squared second derivatives over N frames:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p><strong>MSD(k,m) = SUM[n] |G''(k,n)|^2</strong></p>
                <p>Where G''(k,n) = second derivative of dB magnitude at bin k, frame n</p>
                <p>Feedback: MSD &lt; 0.5 dB^2/frame^2</p>
                <p>Music: MSD &gt;&gt; 0.5 dB^2/frame^2</p>
              </div>
              <p className="mt-2 text-xs">
                The "Summing MSD" method is <strong>140x more computationally efficient</strong> than 
                the original algorithm while maintaining 100% accuracy for speech and classical music.
              </p>
            </Section>

            <Section title="Phase Coherence (Nyquist Criterion)">
              <p className="mb-2">
                True feedback occurs when the <strong>Nyquist stability criterion</strong> is met:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p>Magnitude condition: |G(w)*F(w)| &gt; 1</p>
                <p>Phase condition: <strong>angle(G(w)*F(w)) = n * 2*pi</strong></p>
              </div>
              <p className="mt-2 text-xs">
                This means feedback maintains constant phase relationships. Phase coherence measures this:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p><strong>C(k) = |1/N * SUM[n] e^(j*dPhi(k,n))|</strong></p>
                <p>Where dPhi(k,n) = phase difference between frames at bin k</p>
                <p>Feedback: C &gt; 0.85 (phase-locked)</p>
                <p>Music: C &lt; 0.65 (random phase)</p>
              </div>
            </Section>

            <Section title="Spectral Flatness (Wiener Entropy)">
              <p className="mb-2">
                Measures how tone-like vs noise-like a signal is:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p><strong>SF = geometric_mean(X) / arithmetic_mean(X)</strong></p>
                <p>SF = (PROD[k] X(k))^(1/N) / (1/N * SUM[k] X(k))</p>
              </div>
              <p className="mt-2 text-xs">
                Interpretation:
              </p>
              <ul className="text-xs mt-1 space-y-1">
                <li>SF = 0: Pure tone (single frequency = <strong>feedback</strong>)</li>
                <li>SF = 1: White noise (flat spectrum)</li>
                <li>SF &lt; 0.05: Very tonal (likely feedback)</li>
                <li>SF &gt; 0.15: Broadband (likely music/speech)</li>
              </ul>
            </Section>

            <Section title="Kurtosis">
              <p className="mb-2">
                Measures the "peakiness" of the amplitude distribution:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p><strong>K = E[(X-u)^4] / (E[(X-u)^2])^2 - 3</strong></p>
                <p>Gaussian noise: K = 0</p>
                <p>Pure tone (feedback): K &gt; 10</p>
              </div>
            </Section>

            <Section title="Comb Filter Pattern (DBX)">
              <p className="mb-2">
                Feedback from a single acoustic path creates peaks at <strong>regularly spaced frequencies</strong>:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p><strong>f_n = n * c / (2 * d)</strong></p>
                <p>Where: c = speed of sound (343 m/s), d = path length</p>
                <p>Spacing: <strong>df = c / (2 * d)</strong></p>
              </div>
              <p className="mt-2 text-xs">
                Detection algorithm:
              </p>
              <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
                <li>Find all detected peak frequencies</li>
                <li>Calculate spacing between all pairs</li>
                <li>Find greatest common divisor (GCD) of spacings</li>
                <li>If 3+ peaks match GCD pattern within 5% tolerance, flag as comb</li>
                <li>Calculate predicted future frequencies: f_pred = n * df</li>
              </ol>
            </Section>

            <Section title="Compression Detection">
              <p className="mb-2">
                Dynamically compressed content is detected via <strong>crest factor</strong> and <strong>dynamic range</strong>:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p><strong>Crest Factor = Peak_dB - RMS_dB</strong></p>
                <p>Normal audio: CF = 10-15 dB</p>
                <p>Compressed: CF &lt; 6 dB</p>
                <p><strong>Dynamic Range = Max_dB - Min_dB</strong> (over window)</p>
                <p>Normal: DR &gt; 20 dB</p>
                <p>Compressed: DR &lt; 8 dB</p>
              </div>
              <p className="mt-2 text-xs">
                When compression is detected, MSD reliability drops (sustained notes look like feedback), 
                so phase coherence gets more weight in the fusion algorithm.
              </p>
            </Section>

            <Section title="Algorithm Fusion">
              <p className="mb-2">
                All algorithms vote together with content-aware weighting:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p><strong>P_feedback = w1*S_msd + w2*S_phase + w3*S_spectral + w4*S_comb + w5*S_legacy</strong></p>
              </div>
              <p className="mt-2 text-xs">Default weights by content type:</p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1 mt-2">
                <p>Speech: [0.45, 0.25, 0.15, 0.05, 0.10]</p>
                <p>Music: [0.20, 0.40, 0.15, 0.10, 0.15]</p>
                <p>Compressed: [0.15, 0.45, 0.20, 0.10, 0.10]</p>
              </div>
              <p className="mt-2 text-xs">
                Verdict thresholds:
              </p>
              <ul className="text-xs mt-1 space-y-1">
                <li><strong>FEEDBACK:</strong> P &gt; threshold AND confidence &gt; 0.7</li>
                <li><strong>POSSIBLE:</strong> P &gt; threshold * 0.7</li>
                <li><strong>NOT_FEEDBACK:</strong> P &lt; threshold * 0.5 AND confidence &gt; 0.7</li>
                <li><strong>UNCERTAIN:</strong> Otherwise</li>
              </ul>
            </Section>

            <Section title="Schroeder Frequency (Hopkins, 2007)">
              <p className="mb-2">
                Below the <strong>Schroeder frequency</strong>, individual room modes dominate:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p><strong>f_S = 2000 * sqrt(T / V)</strong></p>
                <p>T = RT60 reverberation time (seconds)</p>
                <p>V = room volume (m^3)</p>
              </div>
              <p className="mt-2 text-xs">
                Example: Conference room T=0.7s, V=250m^3 gives f_S = 106 Hz. Below this, peaks are likely room modes.
              </p>
            </Section>

            <Section title="Q Factor Estimation">
              <p className="mb-2">
                Q measures resonance sharpness, estimated from -3 dB bandwidth:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs">
                <p><strong>Q = f_center / df_3dB</strong></p>
                <p>High Q (&gt;40): Narrow resonance = likely feedback</p>
                <p>Low Q (&lt;4): Broad peak = room mode or instrument</p>
              </div>
            </Section>

            <Section title="A-Weighting (IEC 61672-1)">
              <p className="mb-2">
                Optional A-weighting emphasizes frequencies where human hearing is most sensitive:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                <p>R_A(f) = (12194^2 * f^4) / [(f^2 + 20.6^2)(f^2 + 12194^2) * sqrt((f^2 + 107.7^2)(f^2 + 737.9^2))]</p>
                <p>A(f) = 20 * log10(R_A(f)) + 2.0 dB</p>
              </div>
            </Section>

            <Section title="References">
              <ul className="text-xs space-y-1">
                <li><strong>DAFx-16:</strong> Magnitude Slope Deviation algorithm for feedback detection. 140x efficiency improvement.</li>
                <li><strong>DBX:</strong> Comb filter pattern analysis for feedback suppression systems.</li>
                <li><strong>KU Leuven (2025):</strong> 2-channel AFC algorithm with PEM framework for acoustic feedback control.</li>
                <li>Hopkins, C. (2007). <em>Sound Insulation</em>. Butterworth-Heinemann. Schroeder frequency, modal analysis.</li>
                <li>Grandke, T. (1983). Interpolation algorithms for discrete Fourier transforms. <em>IEEE Trans. Instrum. Meas.</em></li>
                <li>IEC 61672-1:2013. Electroacoustics - Sound level meters - Part 1: Specifications.</li>
                <li>Nyquist, H. (1932). Regeneration theory. <em>Bell System Technical Journal</em>.</li>
              </ul>
            </Section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  )
}
