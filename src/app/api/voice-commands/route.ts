import { NextResponse } from 'next/server'

/**
 * GET /api/voice-commands
 * Returns the list of available voice commands and their Slovenian phrases.
 * Used for documentation/help display in the UI.
 */

interface VoiceCommandInfo {
  id: string
  phrases: string[]
  label: string
  description: string
  action: string
}

const VOICE_COMMANDS: VoiceCommandInfo[] = [
  { id: 'start', phrases: ['Začni sledenje', 'Začni'], label: 'Začni sledenje', description: 'Začne sledenje vožnje', action: 'startTracking' },
  { id: 'stop', phrases: ['Ustavi', 'Ustavi sledenje'], label: 'Ustavi sledenje', description: 'Ustavi sledenje vožnje', action: 'stopTracking' },
  { id: 'pause', phrases: ['Pavza', 'Pavziraj'], label: 'Pavza', description: 'Premor sledenja', action: 'pauseTracking' },
  { id: 'resume', phrases: ['Nadaljuj'], label: 'Nadaljuj', description: 'Nadaljuj sledenje', action: 'resumeTracking' },
  { id: 'location', phrases: ['Kje sem', 'Kje sem zdaj'], label: 'Kje sem', description: 'Pove trenutno lokacijo', action: 'announceLocation' },
  { id: 'speed', phrases: ['Kako hitro', 'Hitrost'], label: 'Hitrost', description: 'Pove trenutno hitrost', action: 'announceSpeed' },
  { id: 'remaining', phrases: ['Koliko še', 'Koliko do cilja'], label: 'Koliko še', description: 'Pove preostalo razdaljo', action: 'announceRemaining' },
  { id: 'hazard', phrases: ['Nevarnost', 'Opozorilo'], label: 'Nevarnost', description: 'Prijavi nevarnost na cesti', action: 'reportHazard' },
  { id: 'navigation', phrases: ['Navigacija', 'Načrtuj ruto'], label: 'Navigacija', description: 'Odpri navigacijo', action: 'openNavigation' },
  { id: 'emergency', phrases: ['SOS', 'Pomoč'], label: 'SOS', description: 'Odpri nujno pomoč', action: 'openEmergency' },
  { id: 'save', phrases: ['Shrani', 'Shrani vožnjo'], label: 'Shrani', description: 'Shrani trenutno vožnjo', action: 'saveRide' },
  { id: 'weather', phrases: ['Vreme'], label: 'Vreme', description: 'Pove trenutno vreme', action: 'announceWeather' },
]

export async function GET() {
  return NextResponse.json({
    data: VOICE_COMMANDS,
    total: VOICE_COMMANDS.length,
    language: 'sl-SI',
    description: 'Seznam razpoložljivih glasovnih ukazov za MotoTrack',
  })
}
