'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'ktr-audio-device'

export interface AudioDevice {
  deviceId: string
  label: string
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>('')
  const mountedRef = useRef(true)

  const enumerate = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }))
      if (mountedRef.current) setDevices(inputs)
      return inputs
    } catch {
      return []
    }
  }, [])

  // Load saved device + initial enumerate
  useEffect(() => {
    mountedRef.current = true
    const saved = localStorage.getItem(STORAGE_KEY) ?? ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: restore saved device preference from localStorage on mount
    setSelectedDeviceIdState(saved)
    enumerate().then(inputs => {
      // If saved device is gone, fall back to default
      if (saved && inputs.length > 0 && !inputs.some(d => d.deviceId === saved)) {
        setSelectedDeviceIdState('')
        localStorage.removeItem(STORAGE_KEY)
      }
    })
    return () => { mountedRef.current = false }
  }, [enumerate])

  // Watch for device changes (plug/unplug)
  useEffect(() => {
    const handler = () => { enumerate() }
    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler)
  }, [enumerate])

  const setSelectedDeviceId = useCallback((id: string) => {
    setSelectedDeviceIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  return { devices, selectedDeviceId, setSelectedDeviceId, refresh: enumerate }
}
