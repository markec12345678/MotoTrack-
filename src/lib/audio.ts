/**
 * Shared AudioContext singleton for all sound alerts in the app.
 *
 * WHY: Each `new AudioContext()` creates its own OS-level audio graph (~2-5 MB).
 * Chrome caps at ~6 simultaneous AudioContexts. Without proper cleanup,
 * a long riding session can exhaust the limit, causing all subsequent audio to fail.
 *
 * SOLUTION: Single shared AudioContext that's reused across all components.
 * Automatically closed on page unload to release OS resources.
 */

let sharedCtx: AudioContext | null = null

/** Get or create the shared AudioContext */
export function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // Resume if suspended (browser autoplay policy)
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume()
    }
    return sharedCtx
  } catch {
    return null
  }
}

/** Close the shared AudioContext and release OS resources */
export function closeAudioContext(): void {
  if (sharedCtx && sharedCtx.state !== 'closed') {
    sharedCtx.close()
    sharedCtx = null
  }
}

// Auto-close on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', closeAudioContext)
}

/**
 * Play a simple beep tone using the shared AudioContext.
 * @param frequency - Hz (default 800)
 * @param duration - seconds (default 0.15)
 * @param volume - gain 0-1 (default 0.1)
 */
export function playBeep(frequency = 800, duration = 0.15, volume = 0.1): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

/**
 * Play a double beep (two tones in sequence) using the shared AudioContext.
 * @param frequency - Hz (default 800)
 * @param gap - seconds between beeps (default 0.15)
 * @param duration - seconds per beep (default 0.1)
 * @param volume - gain 0-1 (default 0.1)
 */
export function playDoubleBeep(frequency = 800, gap = 0.15, duration = 0.1, volume = 0.1): void {
  const ctx = getAudioContext()
  if (!ctx) return

  // First beep
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain1.gain.setValueAtTime(volume, ctx.currentTime)
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc1.start(ctx.currentTime)
  osc1.stop(ctx.currentTime + duration)

  // Second beep
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(frequency, ctx.currentTime + gap + duration)
  gain2.gain.setValueAtTime(0.001, ctx.currentTime + duration)
  gain2.gain.setValueAtTime(volume, ctx.currentTime + gap + duration)
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + gap + duration * 2)
  osc2.start(ctx.currentTime + gap + duration)
  osc2.stop(ctx.currentTime + gap + duration * 2)
}
