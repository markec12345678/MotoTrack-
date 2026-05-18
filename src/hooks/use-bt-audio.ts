'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useBtAudio - Shared hook for routing audio through BT helmet or phone speaker.
 *
 * Checks `window.__mototrack_bt_nav` for a connected BT helmet and provides
 * a `speak` function that routes TTS through the helmet when connected,
 * or falls back to regular browser speechSynthesis.
 *
 * Also reads volume from localStorage `mototrack_bt_volume` (0-100).
 */

// Extend Window type for the BT nav reference
declare global {
  interface Window {
    __mototrack_bt_nav?: ((text: string) => void) | undefined
  }
}

interface UseBtAudioReturn {
  /** Whether a BT helmet is connected with nav prompts enabled */
  isConnected: boolean
  /** Speak text via BT helmet (if connected) or phone speaker */
  speak: (text: string) => void
  /** BT helmet volume 0-100 (from localStorage) */
  volume: number
}

function getInitialVolume(): number {
  if (typeof window === 'undefined') return 80
  try {
    const v = localStorage.getItem('mototrack_bt_volume')
    if (v) {
      const parsed = parseInt(v, 10)
      if (!isNaN(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return 80
}

export function useBtAudio(): UseBtAudioReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [volume, setVolume] = useState(getInitialVolume)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Initialize speechSynthesis ref
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Poll BT connection state (the reference is set/unset by BluetoothHelmet component)
  useEffect(() => {
    const checkBt = () => {
      const connected = typeof window !== 'undefined' && typeof window.__mototrack_bt_nav === 'function'
      setIsConnected(prev => prev !== connected ? connected : prev)
    }

    // Check immediately
    checkBt()

    // Poll every 2 seconds for connection state changes
    const interval = setInterval(checkBt, 2000)

    return () => clearInterval(interval)
  }, [])

  // Listen for volume changes in localStorage (in case user changes it in BT panel)
  useEffect(() => {
    const checkVolume = () => {
      try {
        const v = localStorage.getItem('mototrack_bt_volume')
        if (v) {
          const parsed = parseInt(v, 10)
          if (!isNaN(parsed)) {
            setVolume(prev => prev !== parsed ? parsed : prev)
          }
        }
      } catch {
        // ignore
      }
    }

    const interval = setInterval(checkVolume, 3000)
    return () => clearInterval(interval)
  }, [])

  /**
   * Speak text via BT helmet or phone speaker.
   *
   * If BT helmet is connected (window.__mototrack_bt_nav exists), delegates to it.
   * The BT helmet's sendNavPrompt already applies the correct volume and language.
   *
   * If no BT helmet, uses browser speechSynthesis directly.
   */
  const speak = useCallback((text: string) => {
    // Check if BT helmet nav function is available
    if (typeof window !== 'undefined' && typeof window.__mototrack_bt_nav === 'function') {
      try {
        window.__mototrack_bt_nav(text)
        return
      } catch {
        // If BT nav fails, fall through to regular TTS
      }
    }

    // Fallback: regular browser speechSynthesis
    if (!synthRef.current) {
      // Try to get it on-demand
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis
      } else {
        return
      }
    }

    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'sl-SI'
    utter.rate = 0.95
    utter.volume = 1.0
    const voices = synthRef.current.getVoices()
    const slVoice = voices.find(v => v.lang.startsWith('sl'))
    if (slVoice) utter.voice = slVoice
    synthRef.current.speak(utter)
  }, [])

  return { isConnected, speak, volume }
}
