'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { useBtAudio } from '@/hooks/use-bt-audio'

// ===== VOICE COMMANDS (Web Speech API) =====
// Hands-free voice control for motorcyclists
// Slovenian voice commands with continuous listening mode
// Routes audio feedback through BT helmet when connected

// ─── Voice command definitions ──────────────────────────────────────────
interface VoiceCommand {
  id: string
  phrases: string[]       // Slovenian trigger phrases
  label: string           // Slovenian label for display
  description: string     // Slovenian description
  action: string          // action key
}

const VOICE_COMMANDS: VoiceCommand[] = [
  { id: 'start', phrases: ['začni sledenje', 'začni'], label: 'Začni sledenje', description: 'Začne sledenje vožnje', action: 'startTracking' },
  { id: 'stop', phrases: ['ustavi', 'ustavi sledenje'], label: 'Ustavi sledenje', description: 'Ustavi sledenje vožnje', action: 'stopTracking' },
  { id: 'pause', phrases: ['pavza', 'pavziraj'], label: 'Pavza', description: 'Premor sledenja', action: 'pauseTracking' },
  { id: 'resume', phrases: ['nadaljuj'], label: 'Nadaljuj', description: 'Nadaljuj sledenje', action: 'resumeTracking' },
  { id: 'location', phrases: ['kje sem', 'kje sem zdaj'], label: 'Kje sem', description: 'Pove trenutno lokacijo', action: 'announceLocation' },
  { id: 'speed', phrases: ['kako hitro', 'hitrost'], label: 'Hitrost', description: 'Pove trenutno hitrost', action: 'announceSpeed' },
  { id: 'remaining', phrases: ['koliko še', 'koliko do cilja'], label: 'Koliko še', description: 'Pove preostalo razdaljo', action: 'announceRemaining' },
  { id: 'hazard', phrases: ['nevarnost', 'opozorilo'], label: 'Nevarnost', description: 'Prijavi nevarnost na cesti', action: 'reportHazard' },
  { id: 'navigation', phrases: ['navigacija', 'načrtuj ruto'], label: 'Navigacija', description: 'Odpri navigacijo', action: 'openNavigation' },
  { id: 'emergency', phrases: ['sos', 'pomoč'], label: 'SOS', description: 'Odpri nujno pomoč', action: 'openEmergency' },
  { id: 'save', phrases: ['shrani', 'shrani vožnjo'], label: 'Shrani', description: 'Shrani trenutno vožnjo', action: 'saveRide' },
  { id: 'weather', phrases: ['vreme'], label: 'Vreme', description: 'Pove trenutno vreme', action: 'announceWeather' },
]

// ─── Custom vocabulary hints for better Slovenian recognition ───────────
const VOCAB_HINTS = VOICE_COMMANDS.flatMap(c => c.phrases)

// ─── Props interface ────────────────────────────────────────────────────
interface VoiceCommandsProps {
  isTracking: boolean
  isPaused: boolean
  onStartTracking?: () => void
  onStopTracking?: () => void
  onPauseTracking?: () => void
  onResumeTracking?: () => void
  onReportHazard?: () => void
  onOpenEmergency?: () => void
  onSaveRide?: () => void
  currentSpeed?: number          // km/h
  currentLat?: number | null
  currentLng?: number | null
  navRemainingDistance?: number   // meters
  navETA?: string                // formatted time
  onOpenNavigation?: () => void
  className?: string
}

// ─── SpeechRecognition type declarations ────────────────────────────────
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  grammars: any
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

// ─── Helper: play beep via Web Audio API ────────────────────────────────
function playBeep(frequency: number, duration: number = 0.15): void {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)

    // Clean up after playing
    setTimeout(() => ctx.close(), duration * 1000 + 100)
  } catch {
    // Audio not available
  }
}

// ─── Component ──────────────────────────────────────────────────────────
export default function VoiceCommands({
  isTracking,
  isPaused,
  onStartTracking,
  onStopTracking,
  onPauseTracking,
  onResumeTracking,
  onReportHazard,
  onOpenEmergency,
  onSaveRide,
  currentSpeed = 0,
  currentLat = null,
  currentLng = null,
  navRemainingDistance,
  navETA,
  onOpenNavigation,
  className = '',
}: VoiceCommandsProps) {
  // ─── State ────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [recognizedText, setRecognizedText] = useState<string | null>(null)
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [greenFlash, setGreenFlash] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const autoRestartRef = useRef(true)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // BT audio hook - routes through helmet when connected
  const { speak: btSpeak } = useBtAudio()

  // ─── Check browser support ────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setIsSupported(false)
    }
  }, [])

  // ─── Acquire WakeLock when listening ──────────────────────────────────
  useEffect(() => {
    if (isListening && navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(sentinel => { wakeLockRef.current = sentinel })
        .catch(() => { /* WakeLock not available */ })
    }
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [isListening])

  // ─── Announcement functions (declared before executeCommand) ──────────
  const announceLocation = useCallback(async () => {
    if (currentLat == null || currentLng == null) {
      btSpeak('Lokacija ni na voljo')
      return
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json&accept-language=sl`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        const address = data.display_name || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`
        const shortAddress = address.split(',').slice(0, 3).join(',')
        btSpeak(`Trenutno ste na ${shortAddress}`)
      } else {
        btSpeak(`Koordinate: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`)
      }
    } catch {
      btSpeak(`Koordinate: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`)
    }
  }, [currentLat, currentLng, btSpeak])

  const announceSpeed = useCallback(() => {
    const speed = Math.round(currentSpeed)
    btSpeak(`Trenutna hitrost: ${speed} kilometrov na uro`)
  }, [currentSpeed, btSpeak])

  const announceRemaining = useCallback(() => {
    if (navRemainingDistance != null && navRemainingDistance > 0) {
      const km = (navRemainingDistance / 1000).toFixed(1)
      const etaText = navETA ? `, prihod ob ${navETA}` : ''
      btSpeak(`Do cilja je še ${km} kilometrov${etaText}`)
    } else {
      btSpeak('Navigacija ni aktivna')
    }
  }, [navRemainingDistance, navETA, btSpeak])

  const announceWeather = useCallback(async () => {
    if (currentLat == null || currentLng == null) {
      btSpeak('Lokacija ni na voljo za vremensko napoved')
      return
    }
    try {
      const res = await fetch(
        `/api/weather?lat=${currentLat}&lng=${currentLng}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        const temp = data.current_weather?.temperature
        const wind = data.current_weather?.windspeed
        if (temp != null && wind != null) {
          btSpeak(`Trenutna temperatura ${Math.round(temp)} stopinj, veter ${Math.round(wind)} kilometrov na uro`)
        } else {
          btSpeak('Vremenski podatki niso na voljo')
        }
      } else {
        btSpeak('Vremenski podatki niso na voljo')
      }
    } catch {
      btSpeak('Vremenski podatki niso na voljo')
    }
  }, [currentLat, currentLng, btSpeak])

  // ─── Execute matched command ──────────────────────────────────────────
  const executeCommand = useCallback((command: VoiceCommand) => {
    setIsProcessing(true)
    setGreenFlash(true)
    setTimeout(() => setGreenFlash(false), 600)

    // Success beep (440Hz)
    playBeep(440, 0.15)

    // Show command feedback
    setCommandFeedback(command.label)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setCommandFeedback(null), 3000)

    switch (command.action) {
      case 'startTracking':
        btSpeak('Začenjam sledenje')
        onStartTracking?.()
        break
      case 'stopTracking':
        btSpeak('Ustavljam sledenje')
        onStopTracking?.()
        break
      case 'pauseTracking':
        btSpeak('Premor sledenja')
        onPauseTracking?.()
        break
      case 'resumeTracking':
        btSpeak('Nadaljujem sledenje')
        onResumeTracking?.()
        break
      case 'announceLocation':
        announceLocation()
        break
      case 'announceSpeed':
        announceSpeed()
        break
      case 'announceRemaining':
        announceRemaining()
        break
      case 'reportHazard':
        btSpeak('Prijavljam nevarnost')
        onReportHazard?.()
        break
      case 'openNavigation':
        btSpeak('Odpiram navigacijo')
        onOpenNavigation?.()
        break
      case 'openEmergency':
        btSpeak('Nujna pomoč')
        onOpenEmergency?.()
        break
      case 'saveRide':
        btSpeak('Shranjujem vožnjo')
        onSaveRide?.()
        break
      case 'announceWeather':
        announceWeather()
        break
    }

    setTimeout(() => setIsProcessing(false), 500)
  }, [onStartTracking, onStopTracking, onPauseTracking, onResumeTracking,
    onReportHazard, onOpenEmergency, onSaveRide, onOpenNavigation, btSpeak,
    announceLocation, announceSpeed, announceRemaining, announceWeather])

  // ─── Match recognized text to a command ───────────────────────────────
  const matchCommand = useCallback((text: string): VoiceCommand | null => {
    const normalized = text.toLowerCase().trim()
    for (const cmd of VOICE_COMMANDS) {
      for (const phrase of cmd.phrases) {
        if (normalized.includes(phrase) || phrase.includes(normalized)) {
          return cmd
        }
      }
    }
    return null
  }, [])

  // ─── Initialize SpeechRecognition ─────────────────────────────────────
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return null

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'sl-SI'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    // Add vocabulary hints if grammars are supported
    try {
      if (recognition.grammars && window.SpeechGrammarList) {
        // Add custom phrases as grammar hints for better recognition
        const grammar = `#JSGF V1.0; grammar commands; public <command> = ${VOCAB_HINTS.join(' | ')} ;`
        const speechGrammarList = new window.SpeechGrammarList()
        speechGrammarList.addFromString(grammar, 1)
        recognition.grammars = speechGrammarList
      }
    } catch {
      // Grammars not supported, continue without
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          // Check all alternatives for best match
          let bestCommand: VoiceCommand | null = null
          let bestConfidence = 0

          for (let j = 0; j < result.length; j++) {
            const transcript = result[j].transcript
            const confidence = result[j].confidence

            if (confidence >= 0.6 && confidence > bestConfidence) {
              const cmd = matchCommand(transcript)
              if (cmd) {
                bestCommand = cmd
                bestConfidence = confidence
              }
            }
          }

          // Show recognized text
          const transcript = result[0].transcript
          setRecognizedText(transcript)
          if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current)
          recognizedTimerRef.current = setTimeout(() => setRecognizedText(null), 3000)

          if (bestCommand) {
            executeCommand(bestCommand)
          } else if (result[0].confidence >= 0.6) {
            // Unrecognized command - play low beep
            playBeep(220, 0.2)
            setCommandFeedback('Ukaz ni prepoznan')
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
            feedbackTimerRef.current = setTimeout(() => setCommandFeedback(null), 2000)
          }
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPermissionDenied(true)
        setIsListening(false)
        autoRestartRef.current = false
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors, just continue
      } else if (event.error === 'network') {
        // Network error, try to continue
      } else {
        // Other errors - stop auto-restart
        autoRestartRef.current = false
      }
    }

    recognition.onend = () => {
      // Auto-restart recognition for continuous listening mode
      if (autoRestartRef.current && isListening) {
        try {
          recognition.start()
        } catch {
          // Recognition already started or not available
        }
      }
    }

    return recognition
  }, [isListening, matchCommand, executeCommand])

  // ─── Start/Stop listening ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSupported) return

    autoRestartRef.current = true
    setPermissionDenied(false)

    const recognition = initRecognition()
    if (!recognition) return

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // Recognition failed to start
    }
  }, [isSupported, initRecognition])

  const stopListening = useCallback(() => {
    autoRestartRef.current = false

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Recognition already stopped
      }
      recognitionRef.current = null
    }

    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // ─── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      autoRestartRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore
        }
        recognitionRef.current = null
      }
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current)
    }
  }, [])

  // ─── Not supported message ────────────────────────────────────────────
  if (!isSupported) {
    return (
      <div className={`fixed bottom-24 right-4 z-[10002] ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-white/60 text-xs">
          <MicOff className="size-4 text-white/40" />
          <span>Glasovni ukazi niso podprti v tem brskalniku</span>
        </div>
      </div>
    )
  }

  // ─── Permission denied message ────────────────────────────────────────
  if (permissionDenied) {
    return (
      <div className={`fixed bottom-24 right-4 z-[10002] ${className}`}>
        <div className="flex flex-col gap-2 px-3 py-2 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-500/30 text-white/80 text-xs max-w-48">
          <div className="flex items-center gap-2">
            <MicOff className="size-4 text-red-400" />
            <span className="font-bold text-red-400">Dostop zavrnjen</span>
          </div>
          <span>Omogočite mikrofon v nastavitvah brskalnika za glasovne ukaze.</span>
          <button
            onClick={() => { setPermissionDenied(false); startListening() }}
            className="mt-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Poskusi znova
          </button>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className={`fixed bottom-24 right-4 z-[10002] ${className}`}>
      {/* Recognized text toast (fading) */}
      {recognizedText && (
        <div className="absolute bottom-16 right-0 mb-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs font-medium max-w-56 truncate shadow-lg">
            <span className="text-white/50">&quot;</span>{recognizedText}<span className="text-white/50">&quot;</span>
          </div>
        </div>
      )}

      {/* Command confirmation feedback */}
      {commandFeedback && (
        <div className="absolute bottom-16 right-0 mb-2 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className={`px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-bold max-w-56 truncate shadow-lg ${
            greenFlash
              ? 'bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              : 'bg-primary/20 border-primary/30 text-primary'
          }`}>
            <Volume2 className="size-3 inline mr-1" />
            {commandFeedback}
          </div>
        </div>
      )}

      {/* Floating microphone button */}
      <button
        onClick={toggleListening}
        className={`relative flex items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-95 ${
          isListening
            ? 'size-14 bg-red-500 hover:bg-red-600 shadow-red-500/40'
            : 'size-14 bg-black/70 backdrop-blur-md border border-white/20 hover:bg-black/80 shadow-black/40'
        } ${isProcessing ? 'scale-110' : ''}`}
        title={isListening ? 'Ustavi glasovno prepoznavo' : 'Začni glasovno prepoznavo'}
        aria-label={isListening ? 'Ustavi glasovno prepoznavo' : 'Začni glasovno prepoznavo'}
      >
        {/* Pulse rings when listening */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <div className="absolute inset-[-4px] rounded-full bg-red-500/15 animate-pulse" />
          </>
        )}

        {/* Green flash overlay */}
        {greenFlash && (
          <div className="absolute inset-0 rounded-full bg-emerald-500/50 animate-pulse" />
        )}

        {/* Mic icon */}
        {isListening ? (
          <Mic className="size-6 text-white relative z-10" />
        ) : (
          <Mic className="size-6 text-white/70 relative z-10" />
        )}

        {/* Waveform animation when listening */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-[3px]">
              <div className="w-[3px] h-3 bg-white/40 rounded-full animate-[waveform_0.6s_ease-in-out_infinite]" />
              <div className="w-[3px] h-5 bg-white/50 rounded-full animate-[waveform_0.6s_ease-in-out_infinite_0.1s]" />
              <div className="w-[3px] h-4 bg-white/40 rounded-full animate-[waveform_0.6s_ease-in-out_infinite_0.2s]" />
              <div className="w-[3px] h-5 bg-white/50 rounded-full animate-[waveform_0.6s_ease-in-out_infinite_0.3s]" />
              <div className="w-[3px] h-3 bg-white/40 rounded-full animate-[waveform_0.6s_ease-in-out_infinite_0.4s]" />
            </div>
          </div>
        )}
      </button>

      {/* Listening status indicator */}
      {isListening && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 backdrop-blur-sm">
          <div className="size-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Slušam</span>
        </div>
      )}
    </div>
  )
}
