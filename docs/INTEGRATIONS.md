# Kill The Ring — Hardware & Protocol Integration Specifications

> **Version:** 1.0 | **Date:** 2026-03-14 | **App Version:** 0.95.0

---

## Table of Contents

1. [Integration Architecture Overview](#1-integration-architecture-overview)
2. [Bitfocus Companion Module](#2-bitfocus-companion-module)
3. [Digital Mixer Control](#3-digital-mixer-control)
4. [Dante Audio Network Integration](#4-dante-audio-network-integration)
5. [WebSocket API Specification](#5-websocket-api-specification)
6. [Security Considerations](#6-security-considerations)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Integration Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KILL THE RING (PWA)                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Web Audio │→ │ DSP Worker│→ │ Advisory Mgr │→ │ React State  │  │
│  │ API       │  │ (FFT/     │  │ (detection   │  │ (contexts)   │  │
│  │           │  │  fusion)  │  │  events)     │  │              │  │
│  └──────────┘  └───────────┘  └──────────────┘  └──────┬───────┘  │
│                                                          │          │
│  ┌──────────────────────────────────────────────────────┐│          │
│  │              WebSocket API Server                     ││          │
│  │  ws://localhost:{PORT}/api/v1/ws                      │←─────────│
│  │  - Advisory events (new, updated, cleared)            │          │
│  │  - State queries (advisories, settings, mode)         │          │
│  │  - Commands (dismiss, clear, mode change)             │          │
│  │  - Mixer bridge (EQ commands relayed to mixer)        │          │
│  └──────────┬────────────────────┬───────────────────────┘          │
│             │                    │                                   │
└─────────────┼────────────────────┼───────────────────────────────────┘
              │                    │
    ┌─────────▼─────────┐  ┌──────▼──────────────────┐
    │ Bitfocus Companion │  │ Mixer Bridge Service    │
    │ Module             │  │ (Node.js/Tauri)         │
    │                    │  │                         │
    │ ┌───────────────┐  │  │ ┌───────────────┐      │
    │ │ Stream Deck   │  │  │ │ Behringer X32 │ UDP  │
    │ │ (buttons)     │  │  │ │ OSC :10023    │      │
    │ └───────────────┘  │  │ ├───────────────┤      │
    │ ┌───────────────┐  │  │ │ Yamaha CL/DM  │ TCP  │
    │ │ Actions       │  │  │ │ RCP           │      │
    │ │ Feedbacks     │  │  │ ├───────────────┤      │
    │ │ Variables     │  │  │ │ Allen & Heath │ TCP  │
    │ │ Presets       │  │  │ │ (proprietary) │      │
    │ └───────────────┘  │  │ ├───────────────┤      │
    └────────────────────┘  │ │ QSC Q-SYS    │ TCP  │
                            │ │ QRC :1710     │      │
    ┌────────────────────┐  │ └───────────────┘      │
    │ Dante Via / DAL    │  └─────────────────────────┘
    │ (audio routing)    │
    │                    │
    │ Dante Network ─────┤
    │ (audio over IP)    │
    └────────────────────┘
```

### 1.2 Integration Layers

| Layer | Purpose | Transport | Direction |
|-------|---------|-----------|-----------|
| **WebSocket API** | KTR ↔ external apps | WebSocket (ws/wss) | Bidirectional |
| **Companion Module** | KTR → Stream Deck | WebSocket → Companion SDK | KTR pushes state |
| **Mixer Bridge** | KTR → Mixer | WebSocket → UDP/TCP | KTR sends EQ commands |
| **Dante** | Audio network → KTR | Dante Via / DAL SDK → Web Audio | Audio input |

---

## 2. Bitfocus Companion Module

### 2.1 Overview

[Bitfocus Companion](https://bitfocus.io/companion) is an open-source software platform that turns Elgato Stream Deck, Loupedeck, and other button controllers into professional control surfaces. It supports 300+ products and services through its module system.

Kill The Ring integrates as a **Companion module** — a Node.js package that connects to KTR's WebSocket API and exposes actions, feedbacks, variables, and presets to the Companion interface.

### 2.2 Module Architecture

```
companion-module-killthering/
├── package.json              # Module metadata + dependencies
├── src/
│   ├── main.ts               # Module entry point (extends InstanceBase)
│   ├── config.ts              # Connection configuration (host, port)
│   ├── actions.ts             # Button press actions
│   ├── feedbacks.ts           # Dynamic button appearance
│   ├── variables.ts           # Exposed variables
│   ├── presets.ts             # Pre-configured button templates
│   ├── connection.ts          # WebSocket client to KTR
│   └── types.ts               # Shared types
├── companion/
│   └── manifest.json          # Companion module manifest
└── README.md
```

### 2.3 Connection Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | `127.0.0.1` | Kill The Ring WebSocket host |
| `port` | number | `9741` | Kill The Ring WebSocket port |
| `reconnectInterval` | number | `5000` | Reconnection interval in ms |
| `autoReconnect` | boolean | `true` | Auto-reconnect on disconnect |

```typescript
// config.ts
export const configFields: CompanionInputFieldConfig[] = [
  {
    type: 'textinput',
    id: 'host',
    label: 'Kill The Ring Host',
    default: '127.0.0.1',
    width: 8,
  },
  {
    type: 'number',
    id: 'port',
    label: 'WebSocket Port',
    default: 9741,
    min: 1024,
    max: 65535,
    width: 4,
  },
]
```

### 2.4 Actions (Button Press → Kill The Ring)

| Action ID | Label | Description | Parameters |
|-----------|-------|-------------|------------|
| `dismiss_top` | Dismiss Top Advisory | Dismisses the highest-severity active advisory | None |
| `dismiss_all` | Dismiss All | Clears all active advisories | None |
| `dismiss_by_freq` | Dismiss by Frequency | Dismisses advisory nearest to specified frequency | `frequency: number` |
| `toggle_freeze` | Toggle Freeze | Freezes/unfreezes the spectrum display | None |
| `mark_false_positive` | Mark False Positive | Marks top advisory as false positive (improves detection) | None |
| `set_mode` | Set Operation Mode | Changes operation mode | `mode: 'rehearsal' \| 'live' \| 'install'` |
| `toggle_detection` | Start/Stop Detection | Toggles audio analysis on/off | None |
| `trigger_calibration` | Start Calibration | Begins ambient noise calibration | None |
| `export_session` | Export Session | Triggers PDF/JSON export of current session | `format: 'pdf' \| 'json' \| 'csv' \| 'txt'` |
| `apply_eq` | Apply EQ Recommendation | Sends top advisory's EQ recommendation to connected mixer | None |
| `undo_eq` | Undo Last EQ | Reverts the last EQ change sent to mixer | None |
| `reset_session` | Reset Session | Clears all history and starts fresh | None |

### 2.5 Feedbacks (Kill The Ring → Button Appearance)

| Feedback ID | Label | Description | Button Effect |
|-------------|-------|-------------|---------------|
| `feedback_active` | Feedback Detected | Active feedback advisory exists | Background: severity color (green→yellow→orange→red) |
| `feedback_count` | Advisory Count | Number of active advisories | Text: count badge overlay |
| `feedback_frequency` | Top Frequency | Frequency of highest-severity advisory | Text: formatted frequency (e.g., "2.5k") |
| `feedback_note` | Top Note | Musical note of highest-severity advisory | Text: note name (e.g., "D#5") |
| `feedback_severity` | Top Severity | Severity level of highest advisory | Text: severity label; Color: severity gradient |
| `mode_active` | Mode Indicator | Current operation mode | Text: "RHR"/"LIVE"/"INST"; Color: mode-specific |
| `detection_running` | Detection Status | Whether analysis is active | Color: green=running, gray=stopped |
| `freeze_active` | Freeze Status | Whether display is frozen | Color: blue=frozen, gray=normal |
| `mixer_connected` | Mixer Status | Whether a mixer is connected | Color: green=connected, red=disconnected |
| `eq_pending` | EQ Pending | An EQ recommendation is available to apply | Color: yellow=pending, gray=none |

### 2.6 Variables (Exposed to Companion)

| Variable | Label | Example Value |
|----------|-------|---------------|
| `$(killthering:advisoryCount)` | Active Advisories | `3` |
| `$(killthering:topFrequency)` | Top Frequency (Hz) | `2512` |
| `$(killthering:topFrequencyFormatted)` | Top Frequency (Formatted) | `2.5 kHz` |
| `$(killthering:topNote)` | Top Note | `D#5 +12¢` |
| `$(killthering:topSeverity)` | Top Severity | `ALERT` |
| `$(killthering:topGain)` | Recommended Cut (dB) | `-4.2` |
| `$(killthering:topQ)` | Recommended Q | `8.3` |
| `$(killthering:mode)` | Operation Mode | `live` |
| `$(killthering:isRunning)` | Detection Running | `true` |
| `$(killthering:isFrozen)` | Display Frozen | `false` |
| `$(killthering:inputLevel)` | Input Level (dBFS) | `-18.5` |
| `$(killthering:noiseFloor)` | Noise Floor (dB) | `-62.3` |
| `$(killthering:mixerConnected)` | Mixer Connected | `true` |
| `$(killthering:mixerName)` | Connected Mixer | `X32` |
| `$(killthering:sessionDuration)` | Session Duration | `01:23:45` |
| `$(killthering:totalDetections)` | Total Detections | `17` |

### 2.7 Presets (Pre-Configured Button Templates)

#### Preset: "Feedback Monitor" (2×2 grid)

```
┌─────────────┬─────────────┐
│  FEEDBACK   │   DISMISS   │
│  [2.5 kHz]  │   [ALL]     │
│  ■ RED bg   │   ■ GRAY bg │
├─────────────┼─────────────┤
│   MODE      │   EQ →      │
│  [LIVE]     │  [APPLY]    │
│  ■ GREEN bg │  ■ YELLOW bg│
└─────────────┴─────────────┘
```

#### Preset: "Full Control" (3×2 grid)

```
┌─────────────┬─────────────┬─────────────┐
│  FEEDBACK   │   DISMISS   │   FALSE +   │
│  [2.5 kHz]  │   [TOP]     │   [MARK]    │
├─────────────┼─────────────┼─────────────┤
│  START/STOP │   MODE ↻    │   EQ →      │
│  [■ RUN]    │  [LIVE]     │  [APPLY]    │
└─────────────┴─────────────┴─────────────┘
```

#### Preset: "Advisory Stack" (1×4 vertical)

```
┌─────────────┐
│ Advisory #1 │  ← Highest severity, color-coded
│ [2.5k D#5]  │
├─────────────┤
│ Advisory #2 │
│ [800 G#4]   │
├─────────────┤
│ Advisory #3 │
│ [3.15k D#6] │
├─────────────┤
│ [CLEAR ALL] │
└─────────────┘
```

### 2.8 Companion Module Implementation Notes

1. **Module SDK version:** Use `@companion-module/base` v3.x (latest)
2. **TypeScript:** Module should be in TypeScript for type safety with KTR's shared types
3. **Reconnection:** Use exponential backoff (1s, 2s, 4s, 8s, max 30s)
4. **Status indicator:** Set module status to `ok`, `warning` (reconnecting), or `error` (connection failed)
5. **Image generation:** Use Companion's image API for dynamic button images (frequency spectrum mini-graphs)
6. **Separate repository:** `companion-module-killthering` — published to npm for Companion's module system

---

## 3. Digital Mixer Control

### 3.1 Overview

Kill The Ring can send EQ recommendations directly to digital mixing consoles, automating the feedback reduction workflow. This requires a **bridge service** because browsers cannot directly send UDP/TCP packets.

### 3.2 Mixer Protocol Reference

#### 3.2.1 Behringer X32 / Midas M32 (OSC over UDP)

**Protocol:** [Open Sound Control](https://behringerwiki.musictribe.com/index.php?title=OSC_Remote_Protocol)
**Transport:** UDP port 10023
**Documentation:** [Unofficial X32 OSC Protocol (pmaillot)](https://github.com/pmaillot/X32-Behringer)

**Key OSC Addresses for EQ Control:**

```
# Channel 1-32 parametric EQ (4 bands)
/ch/{ch}/eq/on            # EQ bypass: int 0|1
/ch/{ch}/eq/{band}/type   # Band type: int 0-5 (LCut, LShv, PEQ, VEQ, HShv, HCut)
/ch/{ch}/eq/{band}/f      # Frequency: float 0.0-1.0 (mapped to 20Hz-20kHz log scale)
/ch/{ch}/eq/{band}/g      # Gain: float 0.0-1.0 (mapped to -15dB to +15dB)
/ch/{ch}/eq/{band}/q      # Q factor: float 0.0-1.0 (mapped to 10-0.3)

# Bus 1-16 parametric EQ (6 bands)
/bus/{bus}/eq/{band}/type
/bus/{bus}/eq/{band}/f
/bus/{bus}/eq/{band}/g
/bus/{bus}/eq/{band}/q

# Matrix 1-6 parametric EQ
/mtx/{mtx}/eq/{band}/type
/mtx/{mtx}/eq/{band}/f
/mtx/{mtx}/eq/{band}/g
/mtx/{mtx}/eq/{band}/q

# Main LR parametric EQ (6 bands)
/main/st/eq/{band}/type
/main/st/eq/{band}/f
/main/st/eq/{band}/g
/main/st/eq/{band}/q

# Channel numbers: 01-32 (zero-padded)
# Band numbers: 1-4 (channels) or 1-6 (buses/mains)
# All values are normalized 0.0-1.0
```

**Value Mapping Functions:**

```typescript
// Frequency: 20Hz-20kHz logarithmic mapping
function freqToOsc(hz: number): number {
  // X32 uses log mapping: 0.0 = 20Hz, 1.0 = 20kHz
  return Math.log(hz / 20) / Math.log(1000) // log base 1000 of (hz/20)
}

function oscToFreq(osc: number): number {
  return 20 * Math.pow(1000, osc)
}

// Gain: -15dB to +15dB linear mapping
function gainToOsc(db: number): number {
  return (db + 15) / 30 // 0.0 = -15dB, 0.5 = 0dB, 1.0 = +15dB
}

function oscToGain(osc: number): number {
  return osc * 30 - 15
}

// Q: 10 to 0.3 inverse mapping
function qToOsc(q: number): number {
  // X32 Q range: 0.0 = Q of 10 (narrow), 1.0 = Q of 0.3 (wide)
  return 1 - (Math.log(q / 0.3) / Math.log(10 / 0.3))
}

function oscToQ(osc: number): number {
  return 0.3 * Math.pow(10 / 0.3, 1 - osc)
}
```

**Connection Management:**

```typescript
// X32 requires periodic /xremote messages to maintain connection
// Send every 8-9 seconds (timeout is 10 seconds)
const KEEPALIVE_INTERVAL = 8000

// Send /xremote to keep connection alive
function sendKeepalive(socket: UDPSocket) {
  socket.send('/xremote\0\0\0\0,\0\0\0')
}

// Subscribe to EQ changes for monitoring
function subscribeToEQ(socket: UDPSocket, channel: number) {
  socket.send(`/subscribe /ch/${String(channel).padStart(2, '0')}/eq 10`)
  // 10 = refresh rate in updates per second
}
```

#### 3.2.2 Yamaha DM / CL / RIVAGE (RCP over TCP)

**Protocol:** Yamaha Remote Control Protocol (RCP)
**Transport:** TCP (port varies by model)
**Documentation:** [Unofficial Yamaha RCP Docs](https://github.com/BrenekH/yamaha-rcp-docs)

**Key Commands for EQ Control:**

```
# Message format: text-based, newline-delimited
# Commands: set, get, subscribe, unsubscribe
# Responses: OK, NOTIFY, ERROR

# DM3 Series EQ (4 bands per input channel)
set MIXER:Current/InCh/Fader/On 0 0 1           # Channel 1 on
set MIXER:Current/InCh/Eq/On 0 0 1               # EQ on for channel 1
set MIXER:Current/InCh/Eq/LowFreq 0 0 {value}    # Low band frequency
set MIXER:Current/InCh/Eq/LowGain 0 0 {value}    # Low band gain
set MIXER:Current/InCh/Eq/LowQ 0 0 {value}       # Low band Q
set MIXER:Current/InCh/Eq/LMidFreq 0 0 {value}   # Low-mid frequency
set MIXER:Current/InCh/Eq/LMidGain 0 0 {value}   # Low-mid gain
set MIXER:Current/InCh/Eq/LMidQ 0 0 {value}      # Low-mid Q
set MIXER:Current/InCh/Eq/HMidFreq 0 0 {value}   # High-mid frequency
set MIXER:Current/InCh/Eq/HMidGain 0 0 {value}   # High-mid gain
set MIXER:Current/InCh/Eq/HMidQ 0 0 {value}      # High-mid Q
set MIXER:Current/InCh/Eq/HighFreq 0 0 {value}   # High band frequency
set MIXER:Current/InCh/Eq/HighGain 0 0 {value}   # High band gain
set MIXER:Current/InCh/Eq/HighQ 0 0 {value}      # High band Q

# CL/QL Series (similar but different path prefix)
set MIXER:Current/InputChannel/Fader/Level 0 0 {value}
set MIXER:Current/InputChannel/Eq/On 0 0 1

# Value ranges vary by parameter — consult model-specific docs
# Frequency: varies (integer, model-specific encoding)
# Gain: typically -18dB to +18dB (integer × 100)
# Q: model-specific range
```

**Connection Management:**

```typescript
// Yamaha uses TCP with keep-alive
// Connection string: "YAMAHA\0\0\0\0\0\0\0\0\0\0"
const YAMAHA_HANDSHAKE = Buffer.from('YAMAHA' + '\0'.repeat(10))

// Messages are newline-delimited text
function sendCommand(socket: TCPSocket, command: string) {
  socket.write(command + '\n')
}

// Response parsing
function parseResponse(data: string): YamahaResponse {
  const lines = data.split('\n').filter(l => l.trim())
  return lines.map(line => {
    if (line.startsWith('OK')) return { type: 'ok', data: line }
    if (line.startsWith('NOTIFY')) return { type: 'notify', data: line }
    if (line.startsWith('ERROR')) return { type: 'error', data: line }
    return { type: 'unknown', data: line }
  })
}
```

#### 3.2.3 Allen & Heath (Proprietary Protocol)

**Protocol:** Proprietary binary protocol (reverse-engineered)
**Transport:** TCP
**Documentation:** Limited — [DigiMixer project](https://codeblog.jonskeet.uk/2024/01/02/digimixer-protocols/) has partial documentation

**Status:** Allen & Heath does not publish protocol documentation. The protocol has been partially reverse-engineered by the DigiMixer project (Qu series, CQ series tested). Implementation requires:

1. Wireshark capture of A&H Qu-You or CQ MixPad app traffic
2. Pattern analysis of binary messages
3. Trial-and-error command validation

**Recommendation:** Implement after Behringer and Yamaha. Use DigiMixer's findings as starting point. Focus on Qu series first (most common in churches/small venues).

#### 3.2.4 QSC Q-SYS (QRC over TCP)

**Protocol:** Q-SYS Remote Control (QRC)
**Transport:** TCP port 1710
**Documentation:** Official QSC documentation available (requires Q-SYS Designer account)

```
# QRC message format: JSON-based
# Login required before commands

# Login
{"jsonrpc":"2.0","id":1,"method":"Logon","params":{"User":"","Password":""}}

# Get component control value
{"jsonrpc":"2.0","id":2,"method":"Component.Get","params":{"Name":"Input 1","Controls":[{"Name":"eq.1.freq"}]}}

# Set component control value
{"jsonrpc":"2.0","id":3,"method":"Component.Set","params":{"Name":"Input 1","Controls":[{"Name":"eq.1.freq","Value":2500}]}}
```

### 3.3 Mixer Connection Interface

```typescript
// types/mixer.ts

export type MixerBrand = 'behringer' | 'yamaha' | 'allen-heath' | 'qsc'
export type MixerModel = 'x32' | 'x-air' | 'm32' | 'dm3' | 'dm7' | 'cl' | 'ql' | 'rivage' | 'qu' | 'cq' | 'dlive' | 'q-sys'

export interface MixerConnection {
  readonly brand: MixerBrand
  readonly model: MixerModel
  readonly isConnected: boolean
  readonly channelCount: number
  readonly eqBandsPerChannel: number

  connect(host: string, port?: number): Promise<void>
  disconnect(): void

  // EQ Control
  getChannelEQ(channel: number): Promise<EQState>
  setChannelEQBand(channel: number, band: number, params: EQBandParams): Promise<void>
  setChannelEQBypass(channel: number, bypass: boolean): Promise<void>

  // Monitoring
  getChannelFader(channel: number): Promise<number>  // Returns dB
  getChannelMute(channel: number): Promise<boolean>
  getChannelName(channel: number): Promise<string>

  // Events
  onEQChange(callback: (channel: number, band: number, params: EQBandParams) => void): () => void
  onDisconnect(callback: () => void): () => void
}

export interface EQState {
  bypass: boolean
  bands: EQBand[]
}

export interface EQBand {
  type: 'lowcut' | 'lowshelf' | 'peq' | 'highshelf' | 'highcut'
  frequency: number    // Hz
  gain: number         // dB
  q: number            // Q factor
  enabled: boolean
}

export interface EQBandParams {
  type?: 'lowcut' | 'lowshelf' | 'peq' | 'highshelf' | 'highcut'
  frequency?: number   // Hz
  gain?: number        // dB
  q?: number           // Q factor
  enabled?: boolean
}
```

### 3.4 Safety Controls

**Critical:** Automatic EQ control of a live mixer is a high-risk feature. Safety must be the top priority.

| Control | Default | Configurable | Purpose |
|---------|---------|-------------|---------|
| **Max cut depth** | -6 dB | Yes (-3 to -12 dB) | Prevent excessive cuts that damage sound quality |
| **Confirmation prompt** | Enabled | Yes (can disable for experienced users) | Human approval before each EQ change |
| **Auto-apply mode** | Disabled | Yes (Enterprise only) | Allow automatic EQ without confirmation |
| **Rate limit** | 1 change / 2 seconds | Yes (1-10 seconds) | Prevent rapid-fire changes that confuse the operator |
| **Undo stack** | Last 20 changes | Yes (10-50) | Full undo/redo for all applied changes |
| **Channel whitelist** | All channels | Yes (specify channels) | Only modify specified channels |
| **Frequency range lock** | 200 Hz - 8 kHz | Yes (full range) | Restrict EQ changes to specific frequency range |
| **Kill switch** | Physical button on Companion | N/A | Instantly undo all KTR-applied EQ changes |
| **Mixer connection timeout** | 5 seconds | Yes | Prevent applying EQ to wrong mixer if connection drops |
| **Dry run mode** | Disabled | Yes | Show what would be applied without actually sending commands |

### 3.5 EQ Application Flow

```
1. Advisory detected: "2,512 Hz, ALERT severity"
   │
2. EQ Advisor generates recommendation:
   │  PEQ: -4.2 dB @ 2,512 Hz, Q=8.3
   │
3. Mixer adapter translates to protocol:
   │  Behringer: /ch/01/eq/3/f 0.6973 (2512Hz → normalized)
   │             /ch/01/eq/3/g 0.360  (-4.2dB → normalized)
   │             /ch/01/eq/3/q 0.613  (Q 8.3 → normalized)
   │             /ch/01/eq/3/type 2   (PEQ type)
   │
4. Safety checks:
   │  ✓ Cut depth -4.2 dB ≤ max (-6 dB)
   │  ✓ Frequency 2,512 Hz within allowed range
   │  ✓ Channel 1 in whitelist
   │  ✓ Rate limit not exceeded
   │  ✓ Undo entry saved
   │
5. Confirmation (if enabled):
   │  UI: "Apply -4.2 dB notch at 2.5 kHz (D#5) on Ch 1?"
   │  [Apply] [Skip] [Auto-apply for this session]
   │
6. Command sent to mixer via bridge
   │
7. Verify applied (read back EQ state)
   │
8. Update undo stack
```

### 3.6 Mixer Bridge Service

The bridge runs as a local service because browsers cannot send UDP/TCP packets directly.

**Option A: Standalone Node.js Service**
```
npx killthering-bridge --mixer behringer --host 192.168.1.100
```

**Option B: Companion Module Bridge** (recommended first)
The Companion module already has network access. Add mixer control as a Companion feature — users configure the mixer connection in Companion's UI, and KTR sends EQ commands through the Companion WebSocket.

**Option C: Tauri/Electron Desktop App**
Native desktop app bundles the bridge service. Users launch the desktop app instead of the browser PWA.

---

## 4. Dante Audio Network Integration

### 4.1 Overview

[Dante](https://www.getdante.com/) (Digital Audio Network Through Ethernet) is the dominant audio-over-IP protocol, with 91% market share in networked audio products. Over 5 million Dante-enabled devices are deployed globally.

Kill The Ring can receive audio from Dante networks for analysis, enabling monitoring of any point in a Dante system without physical microphone connections.

### 4.2 Integration Paths

#### Path 1: Dante Via (Zero-Code, Available Now)

**What:** [Dante Via](https://www.getdante.com/products/software-essentials/dante-via/) ($49.99) routes audio between applications and the Dante network on a PC/Mac. It makes any audio application Dante-capable.

**How it works with Kill The Ring:**
```
Dante Network                    Computer
─────────────                    ────────
┌───────────┐    Ethernet    ┌──────────────────────────┐
│ Stage Box │───────────────→│  Dante Via               │
│ (mic in)  │                │  ├─ Routes Dante ch →    │
└───────────┘                │  │  virtual audio device  │
                             │  └────────────────────────│
┌───────────┐                │                           │
│ Mixer     │                │  Kill The Ring (browser)  │
│ (insert   │                │  ├─ Selects virtual       │
│  point)   │                │  │  device as mic input   │
└───────────┘                │  └─ Analyzes audio        │
                             └──────────────────────────┘
```

**Setup steps for users:**
1. Install [Dante Via](https://www.getdante.com/products/software-essentials/dante-via/) ($49.99, 30-day free trial)
2. Connect computer to Dante network via Ethernet (not Wi-Fi — Dante requires wired connection)
3. Open Dante Via → enable Dante control for your speakers/headphones device
4. Open [Dante Controller](https://www.audinate.com/products/software/dante-controller) (free) → route desired Dante channel to the Dante Via receive channel
5. Open Kill The Ring → select the Dante Via virtual audio device as microphone input
6. KTR now analyzes audio from the Dante network in real-time

**Limitations:**
- Up to 16 channels per application (Dante Via limit)
- 10ms added latency from Dante Via packetization (irrelevant for analysis)
- Requires Ethernet connection (no Wi-Fi with Dante)
- $49.99 for Dante Via license (one-time)
- Windows or macOS only (no Linux, no mobile)

**KTR changes needed:** None — just documentation. The existing Web Audio API mic input selection already supports virtual audio devices.

---

#### Path 2: Dante Application Library (DAL) SDK (Desktop App)

**What:** [Dante Application Library](https://www.audinate.com/products/manufacturer-products/dante-application-library) is a native SDK for Windows/macOS that provides direct Dante network access from software applications. Up to 64×64 channels at 48kHz with 4ms latency.

**How it works:**
```
Dante Network                    Desktop App (Tauri/Electron)
─────────────                    ──────────────────────────────
┌───────────┐    Ethernet    ┌──────────────────────────────────┐
│ Stage Box │───────────────→│  Dante Application Library       │
│ (mic in)  │                │  ├─ Receives 64 Dante channels   │
└───────────┘                │  │  at 48kHz / 4ms latency       │
                             │  │                                │
┌───────────┐                │  ├─ Kill The Ring DSP Engine      │
│ Any Dante │                │  │  ├─ Independent FeedbackDetector│
│ device    │                │  │  │  per channel                 │
└───────────┘                │  │  ├─ Per-channel advisories      │
                             │  │  └─ Cross-channel correlation   │
                             │  │                                │
                             │  └─ React UI (WebView)            │
                             │     └─ Multi-channel dashboard     │
                             └──────────────────────────────────┘
```

**Requirements:**
- Licensing agreement with Audinate (DAL SDK access)
- Desktop application (Tauri or Electron — cannot run in browser)
- Windows or macOS (DAL is native C/C++)
- Ethernet connection to Dante network

**KTR changes needed:**
- Desktop app wrapper (Tauri recommended)
- Native DAL integration via Tauri's Rust FFI or Electron's N-API
- Multi-channel FeedbackDetector instances (one per channel)
- Per-channel advisory management
- Multi-channel UI dashboard
- Cross-channel correlation analysis

**Licensing model:** DAL SDK is free for developers. End users need a Dante license — but if they're on a Dante network, they already have Dante-enabled devices with licenses.

---

#### Path 3: Dante Managed API (Cloud/Remote Monitoring)

**What:** [Dante Managed API](https://www.getdante.com/products/network-management/dante-managed-api/) is a GraphQL API for controlling Dante subscriptions and routing. Available to Dante Domain Manager (DDM) and Dante Director customers.

**How it works:**
```
Dante Network          Dante Domain Manager        Kill The Ring
─────────────          ────────────────────        ─────────────
┌───────────┐          ┌────────────────────┐      ┌─────────┐
│ Devices   │←────────→│  DDM Server        │      │ KTR     │
│ on Dante  │          │  ├─ Managed API    │←────→│ ├─ Auto-│
│ network   │          │  │  (GraphQL)      │      │ │ route  │
└───────────┘          │  └─ Device/route   │      │ │ Dante  │
                       │     management     │      │ │ to Via │
                       └────────────────────┘      └─────────┘
```

**Use case:** Automatically route Dante channels to Kill The Ring's audio input. Instead of manually setting up Dante Controller routes, KTR could auto-discover available channels and set up monitoring routes via the Managed API.

**Requirements:**
- Customer must have Dante Domain Manager ($varies) or Dante Director
- API access included free for DDM/Director customers
- GraphQL client in KTR's backend

**KTR changes needed:**
- Backend API route for Dante Managed API proxy
- Dante device discovery UI
- Auto-routing configuration
- Requires user's Dante credentials (stored securely)

---

#### Path 4: Dante SDK Connect Edition (Cloud Analysis)

**What:** [Dante SDK Connect Edition](https://www.getdante.com/products/network-management/dante-sdk-connect-edition/) provides Dante audio transmission for cloud-based applications. Up to 256×256 channels at 48kHz with PTP clocking.

**How it works:** Cloud-hosted KTR instance receives Dante audio streams for remote monitoring. An engineer could monitor a venue's audio from anywhere with internet access.

**Requirements:**
- Linux cloud environment (AWS, GCP, etc.)
- Dante SDK Connect Edition license (customer-side)
- Low-latency internet connection

**KTR changes needed:**
- Cloud-hosted analysis service
- Server-side DSP engine (Node.js or Rust)
- Real-time WebSocket stream of analysis results to browser client
- Remote monitoring dashboard

**Timeline:** Phase 4 — long-term vision. Focus on Paths 1 and 2 first.

### 4.3 Recommended Implementation Order

| Phase | Path | Effort | Prerequisites | User Value |
|-------|------|--------|--------------|------------|
| **Phase 1** | Dante Via documentation | 1-2 days | None | Users can start using Dante audio with KTR immediately |
| **Phase 2** | DAL SDK in desktop app | 15-20 days | Desktop app (Tauri), Audinate licensing | Direct Dante reception, multi-channel |
| **Phase 3** | Managed API integration | 5-7 days | Backend routes, user auth | Auto-routing convenience |
| **Phase 4** | Cloud analysis | 30+ days | Cloud infra, server DSP | Remote monitoring |

### 4.4 Dante Setup Guide (In-App Help Content)

This content should be added to the HelpMenu component as a "Dante Integration" section:

```markdown
## Using Kill The Ring with Dante

Kill The Ring can analyze audio from your Dante network. Here's how:

### What You Need
- A computer connected to your Dante network via Ethernet (not Wi-Fi)
- Dante Via software ($49.99 from Audinate, 30-day free trial available)
- Dante Controller (free download from Audinate)

### Setup Steps
1. **Install Dante Via** — Download from getdante.com/products/software-essentials/dante-via/
2. **Connect to Dante network** — Plug your computer into the same network switch as your Dante devices
3. **Open Dante Via** — Click "Enable Dante control" on your computer's audio output device
4. **Open Dante Controller** — Find the Dante transmitter you want to monitor (e.g., stage box input, mixer insert point)
5. **Route audio** — In Dante Controller, route the desired transmitter channel(s) to your Dante Via receiver
6. **Open Kill The Ring** — Click the microphone icon → select your Dante Via audio device from the dropdown
7. **Start analyzing** — Hit Start — KTR now analyzes your Dante audio in real-time!

### Tips
- Monitor individual mic channels to identify which mic is feeding back
- Monitor the mixer's main output to catch feedback that reaches the PA
- Monitor monitor bus outputs to catch wedge feedback
- Use multiple browser tabs with different Dante channels for multi-channel monitoring
```

---

## 5. WebSocket API Specification

### 5.1 Connection

```
Endpoint: ws://localhost:{PORT}/api/v1/ws
Default Port: 9741
Protocol: JSON messages over WebSocket
```

### 5.2 Message Format

All messages follow this envelope:

```typescript
interface WSMessage {
  type: string           // Message type identifier
  id?: string            // Optional request ID for request/response correlation
  timestamp: number      // Unix timestamp in ms
  payload: unknown       // Type-specific payload
}
```

### 5.3 Server → Client Messages (Events)

```typescript
// New advisory detected
{
  type: 'advisory:new',
  timestamp: 1710422400000,
  payload: {
    id: 'adv_abc123',
    frequencyHz: 2512,
    frequencyFormatted: '2.5 kHz',
    note: 'D#5',
    noteCents: 12,
    severity: 'ALERT',          // POSSIBLE_RING | RING | ALERT | RUNAWAY
    geqBand: '2500',
    peq: { frequency: 2512, gain: -4.2, q: 8.3 },
    shelf: null,
    verdict: 'FEEDBACK',
    confidence: 0.87,
    algorithms: ['msd', 'phase', 'ptmr'],
    mindsDepth: -4.2,
  }
}

// Advisory updated (severity change, etc.)
{
  type: 'advisory:updated',
  timestamp: 1710422401000,
  payload: {
    id: 'adv_abc123',
    changes: { severity: 'RUNAWAY', confidence: 0.95 }
  }
}

// Advisory cleared (no longer active)
{
  type: 'advisory:cleared',
  timestamp: 1710422410000,
  payload: { id: 'adv_abc123', reason: 'resolved' }
}

// State snapshot (sent on connection and periodically)
{
  type: 'state:snapshot',
  timestamp: 1710422400000,
  payload: {
    isRunning: true,
    mode: 'live',
    isFrozen: false,
    inputLevel: -18.5,
    noiseFloor: -62.3,
    advisories: [ /* full advisory objects */ ],
    mixer: { connected: true, brand: 'behringer', model: 'x32', host: '192.168.1.100' },
    sessionDuration: 5025,     // seconds
    totalDetections: 17,
  }
}

// Spectrum data (high-frequency, opt-in)
{
  type: 'spectrum:data',
  timestamp: 1710422400050,
  payload: {
    spectrum: '...base64...',   // Compressed spectrum data
    peaks: [{ hz: 2512, db: -8.3, q: 12.5 }],
  }
}
```

### 5.4 Client → Server Messages (Commands)

```typescript
// Dismiss advisory
{ type: 'command:dismiss', id: 'req_1', payload: { advisoryId: 'adv_abc123' } }

// Dismiss all
{ type: 'command:dismissAll', id: 'req_2', payload: {} }

// Mark false positive
{ type: 'command:falsePositive', id: 'req_3', payload: { advisoryId: 'adv_abc123' } }

// Change mode
{ type: 'command:setMode', id: 'req_4', payload: { mode: 'rehearsal' } }

// Toggle detection
{ type: 'command:toggleDetection', id: 'req_5', payload: {} }

// Toggle freeze
{ type: 'command:toggleFreeze', id: 'req_6', payload: {} }

// Apply EQ to mixer
{ type: 'command:applyEQ', id: 'req_7', payload: {
  advisoryId: 'adv_abc123',
  channel: 1,
  confirm: true,  // false = dry run
}}

// Undo last EQ
{ type: 'command:undoEQ', id: 'req_8', payload: {} }

// Request state snapshot
{ type: 'query:state', id: 'req_9', payload: {} }

// Subscribe to spectrum data
{ type: 'subscribe:spectrum', id: 'req_10', payload: { interval: 100 } } // ms

// Unsubscribe from spectrum data
{ type: 'unsubscribe:spectrum', id: 'req_11', payload: {} }
```

### 5.5 Server → Client Responses

```typescript
// Success response
{ type: 'response:ok', id: 'req_1', timestamp: 1710422400100, payload: { message: 'Advisory dismissed' } }

// Error response
{ type: 'response:error', id: 'req_7', timestamp: 1710422400100, payload: {
  error: 'SAFETY_LIMIT',
  message: 'Cut depth -8.5 dB exceeds maximum -6 dB',
  details: { requested: -8.5, maximum: -6 }
}}
```

---

## 6. Security Considerations

### 6.1 WebSocket API Security

| Concern | Mitigation |
|---------|-----------|
| **Unauthorized access** | Bind to localhost by default (127.0.0.1); require API key for remote connections |
| **API key management** | Generated on first run, stored in KTR settings, displayed in Advanced tab |
| **Cross-origin** | Validate Origin header; reject non-local origins unless explicitly allowed |
| **Message injection** | Validate all incoming messages against schema; reject malformed messages |
| **DoS** | Rate limit commands (10/second); rate limit connections (5 concurrent) |
| **Mixer safety** | All safety controls (Section 3.4) enforced server-side, not client-side |

### 6.2 Mixer Control Security

| Concern | Mitigation |
|---------|-----------|
| **Wrong mixer** | Verify mixer identity (model, firmware version) on connection |
| **Unauthorized EQ changes** | Confirmation prompt by default; undo stack; kill switch |
| **Excessive cuts** | Max cut depth enforced (-6 dB default); frequency range limits |
| **Rapid changes** | Rate limiting (1 change / 2 seconds default) |
| **Connection loss** | If connection to mixer drops during EQ application, abort and alert user |
| **Concurrent control** | Detect if another controller is modifying the same EQ bands; warn user |

### 6.3 Dante Security

| Concern | Mitigation |
|---------|-----------|
| **Dante credentials** | Stored encrypted in OS keychain (not in KTR config files) |
| **Network access** | Dante operates on dedicated audio VLAN; KTR bridge follows same network boundary |
| **Audio capture** | KTR only receives/analyzes audio — never modifies or retransmits |

---

## 7. Implementation Roadmap

### Phase 1: WebSocket API Foundation (Week 1-2)

| Task | File | Effort |
|------|------|--------|
| Design WebSocket message types | `types/websocket.ts` | 1 day |
| Implement WebSocket server (in-app) | `lib/companion/wsServer.ts` | 2-3 days |
| Connect advisory state to WS events | `lib/companion/stateSync.ts` | 1-2 days |
| Add WS port configuration to settings | `components/kill-the-ring/settings/AdvancedTab.tsx` | 0.5 days |
| Test WS API with wscat/postman | — | 1 day |

### Phase 2: Companion Module (Week 3-4)

| Task | File | Effort |
|------|------|--------|
| Scaffold companion-module-killthering | Separate repo | 1 day |
| Implement connection.ts (WS client) | `src/connection.ts` | 1-2 days |
| Implement actions.ts | `src/actions.ts` | 1-2 days |
| Implement feedbacks.ts | `src/feedbacks.ts` | 1-2 days |
| Implement variables.ts | `src/variables.ts` | 1 day |
| Create presets (3 templates) | `src/presets.ts` | 1 day |
| Test with physical Stream Deck | — | 1-2 days |
| Publish module to Companion registry | — | 0.5 days |

### Phase 3: Mixer Bridge - Behringer (Week 5-7)

| Task | File | Effort |
|------|------|--------|
| Design MixerConnection interface | `types/mixer.ts` | 1 day |
| Implement Behringer OSC adapter | `lib/mixer/behringer.ts` | 3-5 days |
| OSC value mapping functions | `lib/mixer/oscMapping.ts` | 1-2 days |
| Safety controls module | `lib/mixer/safety.ts` | 2-3 days |
| Undo stack implementation | `lib/mixer/undoStack.ts` | 1-2 days |
| EQ application UI (confirmation dialog) | `components/kill-the-ring/MixerEQDialog.tsx` | 2-3 days |
| Bridge service (standalone or via Companion) | `lib/mixer/bridge.ts` | 2-3 days |
| Integration testing with X32 hardware | — | 2-3 days |

### Phase 4: Additional Mixer Support (Week 8-10)

| Task | Effort |
|------|--------|
| Yamaha RCP adapter | 3-5 days |
| Allen & Heath adapter (Qu series) | 5-7 days (reverse engineering) |
| QSC Q-SYS adapter | 2-3 days |
| Multi-mixer connection management | 2-3 days |

### Phase 5: Dante Integration (Week 11-13)

| Task | Effort |
|------|--------|
| Dante Via documentation + in-app guide | 1-2 days |
| Dante setup wizard UI component | 2-3 days |
| Desktop app wrapper (Tauri) | 5-7 days |
| DAL SDK integration (Tauri Rust FFI) | 7-10 days |
| Multi-channel dashboard | 5-7 days |

---

*This integration specification was developed based on official and community documentation for Bitfocus Companion, Behringer/Midas OSC, Yamaha RCP, QSC QRC, and Audinate Dante protocols. Protocol details should be verified against the latest firmware versions of target devices.*
