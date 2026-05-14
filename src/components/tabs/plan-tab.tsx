'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Route, Trash2, Save, MapPin, X, Upload, Plus, Calendar, Minus, Hotel, Fuel, ChevronDown, ChevronUp, Eye, Clock, RefreshCw, Navigation, ArrowLeft, ArrowRight, Cloud, Wind, AlertTriangle, Thermometer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import TwistyRoutePlanner from '@/components/twisty-route-planner'
import GpxManager from '@/components/gpx-manager'
import OfflineMapsManager from '@/components/offline-maps-manager'
import { categoryLabel, haversine } from '@/components/tabs/types'
import type { TripData, TripDayData } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

interface DayPlan {
  dayNumber: number
  title: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  waypoints: Array<{ lat: number; lng: number }>
  distance: number
  duration: number
  notes: string
  accommodation: string
  fuelStop: boolean
}

interface PlanTabProps {
  waypoints: Array<{ lat: number; lng: number }>
  setWaypoints: React.Dispatch<React.SetStateAction<Array<{ lat: number; lng: number }>>>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  category: string
  setCategory: React.Dispatch<React.SetStateAction<string>>
  avoidHighways: boolean
  setAvoidHighways: React.Dispatch<React.SetStateAction<boolean>>
  distance: number
  onMapClick: (lat: number, lng: number) => void
  onSave: () => void
  userId: string
  onRefresh: () => void
}

type PlanMode = 'single' | 'roundtrip' | 'multiday'
type Curviness = 'straight' | 'moderate' | 'twisty'
type Direction = 'left' | 'right'

const dayColors = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

function getDayColor(dayNumber: number): string {
  return dayColors[(dayNumber - 1) % dayColors.length]
}

function emptyDay(num: number): DayPlan {
  return {
    dayNumber: num,
    title: `Dan ${num}`,
    startLat: 46.15,
    startLng: 14.99,
    endLat: 46.15,
    endLng: 14.99,
    waypoints: [],
    distance: 0,
    duration: 0,
    notes: '',
    accommodation: '',
    fuelStop: false,
  }
}

// Round trip generation algorithm
function generateRoundTrip(
  startLat: number,
  startLng: number,
  targetDistanceKm: number,
  curviness: Curviness,
  direction: Direction
): Array<{ lat: number; lng: number }> {
  // Seed based on current time for unique routes each generation
  const seed = Date.now()
  // Simple seeded random: use a closure with mutable state
  let rngState = seed
  const seededRandom = () => {
    rngState = (rngState * 1664525 + 1013904223) & 0xffffffff
    return (rngState >>> 0) / 0xffffffff
  }

  // Determine number of waypoints based on curviness
  // More waypoints = twistier route
  let numWaypoints: number
  let radiusVariation: number // How much the radius can vary from ideal
  let angleJitter: number // How much angular jitter to add

  switch (curviness) {
    case 'straight':
      numWaypoints = Math.max(4, Math.round(targetDistanceKm / 80))
      radiusVariation = 0.1
      angleJitter = 0.05
      break
    case 'moderate':
      numWaypoints = Math.max(6, Math.round(targetDistanceKm / 40))
      radiusVariation = 0.25
      angleJitter = 0.15
      break
    case 'twisty':
      numWaypoints = Math.max(8, Math.round(targetDistanceKm / 20))
      radiusVariation = 0.4
      angleJitter = 0.25
      break
  }

  // Calculate approximate radius for a circle with the target circumference
  // circumference = 2 * PI * r, so r = circumference / (2 * PI)
  // But routes are not perfect circles, so adjust
  const idealRadiusKm = targetDistanceKm / (2 * Math.PI)

  // Direction: left = counter-clockwise, right = clockwise
  const directionMultiplier = direction === 'left' ? 1 : -1

  // Generate waypoints in a rough circle/ellipse
  const waypoints: Array<{ lat: number; lng: number }> = []

  // Start point
  waypoints.push({ lat: startLat, lng: startLng })

  for (let i = 1; i < numWaypoints; i++) {
    // Distribute points around the circle, leaving the last segment for return
    const baseAngle = (i / numWaypoints) * 2 * Math.PI * directionMultiplier

    // Add angular jitter for more interesting routes
    const jitteredAngle = baseAngle + (seededRandom() - 0.5) * angleJitter * 2 * Math.PI / numWaypoints

    // Vary the radius for a more natural shape
    const radiusFactor = 1 + (seededRandom() - 0.5) * 2 * radiusVariation
    const pointRadiusKm = idealRadiusKm * radiusFactor

    // Convert to lat/lng offset
    // 1 degree lat ≈ 111 km, 1 degree lng ≈ 111 * cos(lat) km
    const latOffset = pointRadiusKm * Math.sin(jitteredAngle) / 111
    const lngOffset = pointRadiusKm * Math.cos(jitteredAngle) / (111 * Math.cos(startLat * Math.PI / 180))

    // For twisty routes, add additional "wobble" between waypoints
    if (curviness === 'twisty' && seededRandom() > 0.4) {
      // Add an intermediate wobble point slightly before the main point
      const wobbleAngle = jitteredAngle - directionMultiplier * 0.15
      const wobbleRadius = pointRadiusKm * (0.7 + seededRandom() * 0.5)
      const wobbleLat = startLat + wobbleRadius * Math.sin(wobbleAngle) / 111
      const wobbleLng = startLng + wobbleRadius * Math.cos(wobbleAngle) / (111 * Math.cos(startLat * Math.PI / 180))
      waypoints.push({ lat: wobbleLat, lng: wobbleLng })
    }

    waypoints.push({
      lat: startLat + latOffset,
      lng: startLng + lngOffset,
    })
  }

  // Return to start (close the loop)
  waypoints.push({ lat: startLat, lng: startLng })

  return waypoints
}

// Calculate total distance of waypoints
function calculateWaypointsDistance(wps: Array<{ lat: number; lng: number }>): number {
  let dist = 0
  for (let i = 1; i < wps.length; i++) {
    dist += haversine(wps[i - 1].lat, wps[i - 1].lng, wps[i].lat, wps[i].lng)
  }
  return Math.round(dist * 10) / 10
}

const curvinessOptions: { value: Curviness; label: string; emoji: string; desc: string }[] = [
  { value: 'straight', label: 'Ravna', emoji: '➡️', desc: 'Manj ovinkov, daljše ravnine' },
  { value: 'moderate', label: 'Zmerna', emoji: '↗️', desc: 'Zmerno vijugasta, uravnotežena' },
  { value: 'twisty', label: 'Vijugasta', emoji: '🔄', desc: 'Veliko ovinkov, vijugasta' },
]

// Weather Along Route mini-component
function WeatherAlongRoute({ waypoints }: { waypoints: { lat: number; lng: number }[] }) {
  const [weatherData, setWeatherData] = useState<Array<{
    lat: number; lng: number; temperature: number | null; windspeed: number | null;
    description: string; isWindDangerous: boolean; precipitation: number | null;
  }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fetchWeather = useCallback(async () => {
    if (waypoints.length < 2) { toast.error('Dodajte vsaj dve točki za vremensko napoved'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/weather-along-route?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`)
      if (res.ok) {
        const j = await res.json()
        setWeatherData(j.data)
        setExpanded(true)
      } else { toast.error('Napaka pri pridobivanju vremena') }
    } catch { toast.error('Napaka pri povezavi') }
    setLoading(false)
  }, [waypoints])

  const hasWindDanger = weatherData?.some(w => w.isWindDangerous)

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Cloud className="size-3.5 text-primary" /> Vreme ob poti
          {hasWindDanger && (
            <span className="flex items-center gap-0.5 text-red-400 text-[10px] font-bold">
              <AlertTriangle className="size-3" /> Močan veter!
            </span>
          )}
        </h4>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" disabled={loading || waypoints.length < 2} onClick={fetchWeather}>
          {loading ? <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Cloud className="size-3" />}
          Preveri vreme
        </Button>
      </div>

      {expanded && weatherData && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          {weatherData.map((w, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${w.isWindDangerous ? 'bg-red-500/10 border border-red-500/20' : 'bg-secondary/50'}`}>
              <Thermometer className="size-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{w.temperature !== null ? `${w.temperature}°C` : '—'}</span>
              <span className="text-muted-foreground">{w.description}</span>
              <Wind className={`size-3 ml-auto shrink-0 ${w.isWindDangerous ? 'text-red-400' : 'text-muted-foreground'}`} />
              <span className={w.isWindDangerous ? 'text-red-400 font-bold' : 'text-muted-foreground'}>
                {w.windspeed !== null ? `${w.windspeed} km/h` : '—'}
              </span>
              {w.precipitation !== null && w.precipitation > 0 && (
                <span className="text-sky-400 flex items-center gap-0.5">
                  💧{w.precipitation}mm
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {waypoints.length < 2 && (
        <p className="text-[10px] text-muted-foreground">Dodajte vsaj dve točki na zemljevid za vremensko napoved</p>
      )}
    </div>
  )
}

export default function PlanTab({
  waypoints, setWaypoints, title, setTitle,
  category, setCategory, avoidHighways, setAvoidHighways,
  distance, onMapClick, onSave, userId, onRefresh,
}: PlanTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mode: 'single', 'roundtrip', or 'multiday'
  const [mode, setMode] = useState<PlanMode>('single')

  // Round trip state
  const [rtStartLat, setRtStartLat] = useState(46.0569)
  const [rtStartLng, setRtStartLng] = useState(14.5058)
  const [rtStartDetected, setRtStartDetected] = useState(false)
  const [rtDistance, setRtDistance] = useState(80)
  const [rtCurviness, setRtCurviness] = useState<Curviness>('moderate')
  const [rtDirection, setRtDirection] = useState<Direction>('right')
  const [rtWaypoints, setRtWaypoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [rtGenerated, setRtGenerated] = useState(false)

  // Multi-day trip state
  const [tripTitle, setTripTitle] = useState('')
  const [tripDescription, setTripDescription] = useState('')
  const [tripStartDate, setTripStartDate] = useState('')
  const [tripEndDate, setTripEndDate] = useState('')
  const [tripDays, setTripDays] = useState<DayPlan[]>([emptyDay(1)])
  const [activeDay, setActiveDay] = useState(0) // index
  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)

  // Saved trips
  const [savedTrips, setSavedTrips] = useState<TripData[]>([])
  const [viewingTrip, setViewingTrip] = useState<TripData | null>(null)

  // Auto-detect GPS on mount for round trip
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setRtStartLat(pos.coords.latitude)
          setRtStartLng(pos.coords.longitude)
          setRtStartDetected(true)
        },
        () => {
          // Default to Ljubljana
          setRtStartLat(46.0569)
          setRtStartLng(14.5058)
          setRtStartDetected(false)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  // Round trip distance calculation
  const rtCalculatedDistance = useMemo(() => {
    if (rtWaypoints.length < 2) return 0
    return calculateWaypointsDistance(rtWaypoints)
  }, [rtWaypoints])

  // Generate round trip
  const generateRoundTripRoute = useCallback(() => {
    const wps = generateRoundTrip(rtStartLat, rtStartLng, rtDistance, rtCurviness, rtDirection)
    setRtWaypoints(wps)
    setRtGenerated(true)
    // Also set as main waypoints so they show on map
    setWaypoints(wps)
  }, [rtStartLat, rtStartLng, rtDistance, rtCurviness, rtDirection, setWaypoints])

  // Shuffle (regenerate) round trip
  const shuffleRoundTrip = useCallback(() => {
    // Add a small delay to ensure seed changes
    setTimeout(() => {
      const wps = generateRoundTrip(rtStartLat, rtStartLng, rtDistance, rtCurviness, rtDirection)
      setRtWaypoints(wps)
      setRtGenerated(true)
      setWaypoints(wps)
    }, 10)
  }, [rtStartLat, rtStartLng, rtDistance, rtCurviness, rtDirection, setWaypoints])

  // Save round trip as route
  const saveRoundTrip = useCallback(async () => {
    if (rtWaypoints.length < 3) {
      toast.error('Generirajte pot pred shranjevanjem')
      return
    }
    try {
      const routeData = JSON.stringify(rtWaypoints.map(w => [w.lat, w.lng]))
      const rtTitle = title || `Krožna pot ${rtDistance}km - ${new Date().toLocaleDateString('sl-SI')}`
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rtTitle,
          description: `Krožna pot: ${rtDistance}km, ${curvinessOptions.find(c => c.value === rtCurviness)?.label || rtCurviness}, ${rtDirection === 'left' ? 'Levo' : 'Desno'}`,
          distance: rtCalculatedDistance,
          waypoints: JSON.stringify(rtWaypoints),
          routeData,
          category: rtCurviness === 'twisty' ? 'twisty' : rtCurviness === 'straight' ? 'scenic' : 'scenic',
          difficulty: rtCurviness === 'twisty' ? 'hard' : rtCurviness === 'moderate' ? 'medium' : 'easy',
          isPublic: true,
        }),
      })
      if (res.ok) {
        toast.success('Krožna pot shranjena!')
        onRefresh()
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }, [rtWaypoints, rtDistance, rtCurviness, rtDirection, rtCalculatedDistance, title, onRefresh])

  // Map click handler for multi-day: add waypoint to active day
  const handleMultiDayMapClick = useCallback((lat: number, lng: number) => {
    setTripDays(prev => {
      const updated = [...prev]
      const day = { ...updated[activeDay] }
      day.waypoints = [...day.waypoints, { lat, lng }]
      // Update start/end from waypoints
      if (day.waypoints.length === 1) {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[0].lat
        day.endLng = day.waypoints[0].lng
      } else {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[day.waypoints.length - 1].lat
        day.endLng = day.waypoints[day.waypoints.length - 1].lng
      }
      // Recalculate distance
      let dist = 0
      for (let i = 1; i < day.waypoints.length; i++) {
        dist += haversine(day.waypoints[i - 1].lat, day.waypoints[i - 1].lng, day.waypoints[i].lat, day.waypoints[i].lng)
      }
      day.distance = Math.round(dist * 10) / 10
      // Estimate duration: avg 60 km/h
      day.duration = Math.round((dist / 60) * 60)
      updated[activeDay] = day
      return updated
    })
  }, [activeDay])

  // Handle map click based on mode
  const handleMapClickInternal = useCallback((lat: number, lng: number) => {
    if (mode === 'multiday') {
      handleMultiDayMapClick(lat, lng)
    } else if (mode === 'single') {
      onMapClick(lat, lng)
    }
    // Roundtrip mode: no map click for adding waypoints
  }, [mode, handleMultiDayMapClick, onMapClick])

  // Calculate total trip distance
  const totalTripDistance = tripDays.reduce((sum, d) => sum + d.distance, 0)

  // Add day
  const addDay = () => {
    const lastDay = tripDays[tripDays.length - 1]
    const newDay: DayPlan = {
      ...emptyDay(tripDays.length + 1),
      startLat: lastDay?.endLat || 46.15,
      startLng: lastDay?.endLng || 14.99,
    }
    setTripDays(prev => [...prev, newDay])
    setActiveDay(tripDays.length)
    setExpandedDay(tripDays.length)
  }

  // Remove day
  const removeDay = (index: number) => {
    if (tripDays.length <= 1) return
    const updated = tripDays.filter((_, i) => i !== index).map((d, i) => ({ ...d, dayNumber: i + 1 }))
    setTripDays(updated)
    if (activeDay >= updated.length) setActiveDay(updated.length - 1)
    if (expandedDay !== null && expandedDay >= updated.length) setExpandedDay(updated.length - 1)
  }

  // Update day field
  const updateDay = (index: number, field: keyof DayPlan, value: unknown) => {
    setTripDays(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // Remove waypoint from day
  const removeWaypoint = (dayIndex: number, wpIndex: number) => {
    setTripDays(prev => {
      const updated = [...prev]
      const day = { ...updated[dayIndex] }
      day.waypoints = day.waypoints.filter((_, i) => i !== wpIndex)
      // Update start/end
      if (day.waypoints.length > 0) {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[day.waypoints.length - 1].lat
        day.endLng = day.waypoints[day.waypoints.length - 1].lng
      }
      // Recalculate distance
      let dist = 0
      for (let i = 1; i < day.waypoints.length; i++) {
        dist += haversine(day.waypoints[i - 1].lat, day.waypoints[i - 1].lng, day.waypoints[i].lat, day.waypoints[i].lng)
      }
      day.distance = Math.round(dist * 10) / 10
      day.duration = Math.round((dist / 60) * 60)
      updated[dayIndex] = day
      return updated
    })
  }

  // Save trip
  const saveTrip = async () => {
    if (!tripTitle.trim()) {
      toast.error('Vnesite naslov potovanja')
      return
    }
    if (!tripStartDate || !tripEndDate) {
      toast.error('Izberite datume potovanja')
      return
    }
    if (!userId) {
      toast.error('Uporabnik ni prijavljen')
      return
    }

    setSaving(true)
    try {
      const daysData = tripDays.map(d => ({
        dayNumber: d.dayNumber,
        title: d.title,
        startLat: d.startLat,
        startLng: d.startLng,
        endLat: d.endLat,
        endLng: d.endLng,
        waypoints: JSON.stringify(d.waypoints),
        distance: d.distance,
        duration: d.duration,
        notes: d.notes || undefined,
        accommodation: d.accommodation || undefined,
        fuelStop: d.fuelStop,
      }))

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tripTitle,
          description: tripDescription,
          startDate: tripStartDate,
          endDate: tripEndDate,
          isPublic: true,
          userId,
          days: daysData,
        }),
      })

      if (res.ok) {
        toast.success('Potovanje shranjeno!')
        setTripTitle('')
        setTripDescription('')
        setTripStartDate('')
        setTripEndDate('')
        setTripDays([emptyDay(1)])
        setActiveDay(0)
        setExpandedDay(0)
        fetchSavedTrips()
      } else {
        toast.error('Napaka pri shranjevanju potovanja')
      }
    } catch {
      toast.error('Napaka pri shranjevanju potovanja')
    } finally {
      setSaving(false)
    }
  }

  // Fetch saved trips
  const fetchSavedTrips = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/trips?userId=${userId}`)
      if (res.ok) {
        const j = await res.json()
        setSavedTrips(j.data || [])
      }
    } catch {
      // ignore
    }
  }, [userId])

  useEffect(() => {
    fetchSavedTrips()
  }, [fetchSavedTrips])

  // Delete trip
  const deleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Potovanje izbrisano')
        if (viewingTrip?.id === tripId) setViewingTrip(null)
        fetchSavedTrips()
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }

  // View trip on map
  const viewTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (res.ok) {
        const j = await res.json()
        setViewingTrip(j.data || null)
      }
    } catch {
      toast.error('Napaka pri nalaganju potovanja')
    }
  }

  // Prepare trip days for map display
  const mapTripDays: TripDayData[] | undefined = viewingTrip
    ? viewingTrip.tripDays
    : mode === 'multiday'
      ? tripDays.map(d => ({
          id: `new-${d.dayNumber}`,
          dayNumber: d.dayNumber,
          title: d.title,
          startLat: d.startLat,
          startLng: d.startLng,
          endLat: d.endLat,
          endLng: d.endLng,
          waypoints: JSON.stringify(d.waypoints),
          distance: d.distance,
          duration: d.duration,
          notes: d.notes || null,
          accommodation: d.accommodation || null,
          fuelStop: d.fuelStop,
        }))
      : undefined

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast.error('Izberite datoteko formata .gpx')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', userId)
      const res = await fetch('/api/gpx/import', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('GPX uspešno uvožen!')
        onRefresh()
      } else {
        toast.error('Napaka pri uvozu GPX')
      }
    } catch {
      toast.error('Napaka pri uvozu GPX')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Auto-set end date based on start date and days
  useEffect(() => {
    if (tripStartDate && tripDays.length > 0) {
      const start = new Date(tripStartDate)
      const end = new Date(start)
      end.setDate(end.getDate() + tripDays.length - 1)
      const endStr = end.toISOString().split('T')[0]
      if (endStr !== tripEndDate) {
        setTripEndDate(endStr)
      }
    }
  }, [tripStartDate, tripDays.length, tripEndDate])

  // Determine planWaypoints for the map based on mode
  const mapPlanWaypoints = mode === 'roundtrip' ? rtWaypoints : (mode === 'single' ? waypoints : [])
  const mapShowPlan = mode === 'single' || mode === 'roundtrip'

  return (
    <div className="relative w-full h-[calc(100vh-104px)] flex flex-col lg:flex-row">
      <div className="flex-1 relative">
        <MotoMap
          center={[46.15, 14.99]}
          zoom={8}
          rides={[]}
          routes={[]}
          planWaypoints={mapPlanWaypoints}
          showPlan={mapShowPlan}
          onMapClick={handleMapClickInternal}
          tripDays={mapTripDays}
        />
      </div>
      <div className="lg:w-96 w-full bg-card border-t lg:border-t-0 lg:border-l border-border/50 p-4 overflow-y-auto max-h-[40vh] lg:max-h-full">
        {/* Mode toggle - 3 options */}
        <div className="flex items-center gap-0.5 mb-4 bg-secondary/50 rounded-lg p-1">
          <button
            className={`flex-1 text-xs font-medium py-2 px-2 rounded-md transition-all ${
              mode === 'single' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('single'); setViewingTrip(null) }}
          >
            Enodnevna pot
          </button>
          <button
            className={`flex-1 text-xs font-medium py-2 px-2 rounded-md transition-all ${
              mode === 'roundtrip' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('roundtrip'); setViewingTrip(null) }}
          >
            Krožna pot
          </button>
          <button
            className={`flex-1 text-xs font-medium py-2 px-2 rounded-md transition-all ${
              mode === 'multiday' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('multiday'); setViewingTrip(null) }}
          >
            Večdnevno potovanje
          </button>
        </div>

        {mode === 'single' ? (
          /* ===== SINGLE DAY MODE ===== */
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Route className="size-5 text-primary" />Načrtuj pot</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ime poti</label>
              <Input placeholder="Npr. Obala do Pirana" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorija</label>
              <div className="flex flex-wrap gap-2">
                {['scenic', 'twisty', 'offroad', 'city'].map(cat => (
                  <Button key={cat} variant={category === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setCategory(cat)}>
                    {categoryLabel(cat)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Izogni se avtocestam</label>
              <Switch checked={avoidHighways} onCheckedChange={setAvoidHighways} />
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Točke ({waypoints.length})</label>
                {waypoints.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { setWaypoints([]) }}>
                    <Trash2 className="size-3 mr-1" />Počisti
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-40">
                {waypoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Kliknite na zemljevid za dodajanje točk</p>
                ) : (
                  <div className="space-y-1">
                    {waypoints.map((wp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3 text-primary" />
                          <span>Točka {i + 1}</span>
                          <span className="text-muted-foreground">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => setWaypoints(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            {waypoints.length > 1 && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Skupna razdalja</span>
                  <span className="font-bold text-primary">{distance} km</span>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={onSave} disabled={waypoints.length < 2}>
              <Save className="size-4 mr-2" />Shrani pot
            </Button>

            {/* GPX Import */}
            <Separator />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4 mr-2" />Uvozi GPX
              </Button>
            </div>

            {/* Advanced Planning Tools */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Napredna orodja</h3>
              <TwistyRoutePlanner userId={userId} onRouteGenerated={(wps) => { setWaypoints(wps) }} />
              <OfflineMapsManager userId={userId} />
              <GpxManager userId={userId} onRefresh={onRefresh} />

              {/* Weather Along Route */}
              <WeatherAlongRoute waypoints={waypoints} />
            </div>
          </div>
        ) : mode === 'roundtrip' ? (
          /* ===== ROUND TRIP MODE ===== */
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><RefreshCw className="size-5 text-primary" />Krožna pot</h2>

            {/* Starting point */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Navigation className="size-3" /> Izhodišče
                </label>
                {rtStartDetected && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                    GPS zaznan
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {rtStartDetected ? 'Vaša lokacija' : 'Ljubljana (privzeto)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rtStartLat.toFixed(4)}, {rtStartLng.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>

            {/* Distance slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Željena razdalja</label>
                <span className="text-sm font-bold text-primary">{rtDistance} km</span>
              </div>
              <Slider
                value={[rtDistance]}
                min={30}
                max={300}
                step={10}
                onValueChange={(v) => setRtDistance(v[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>30 km</span>
                <span>150 km</span>
                <span>300 km</span>
              </div>
            </div>

            {/* Curviness preference */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Zavitanost</label>
              <div className="grid grid-cols-3 gap-2">
                {curvinessOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center ${
                      rtCurviness === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:bg-secondary/50'
                    }`}
                    onClick={() => setRtCurviness(opt.value)}
                  >
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Smer vožnje</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    rtDirection === 'left'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/30'
                  }`}
                  onClick={() => setRtDirection('left')}
                >
                  <ArrowLeft className="size-4" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">Levo</p>
                    <p className="text-[10px] opacity-70">Nasprotno urini kazalc</p>
                  </div>
                </button>
                <button
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    rtDirection === 'right'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/30'
                  }`}
                  onClick={() => setRtDirection('right')}
                >
                  <ArrowRight className="size-4" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">Desno</p>
                    <p className="text-[10px] opacity-70">V smeri urinih kazalcev</p>
                  </div>
                </button>
              </div>
            </div>

            <Separator />

            {/* Generate / Shuffle buttons */}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={generateRoundTripRoute}>
                <RefreshCw className="size-4 mr-2" />Generiraj pot
              </Button>
              {rtGenerated && (
                <Button variant="outline" onClick={shuffleRoundTrip} title="Ponovno generiraj">
                  <RefreshCw className="size-4" />
                </Button>
              )}
            </div>

            {/* Generated route info */}
            {rtGenerated && rtWaypoints.length > 0 && (
              <>
                <div className="bg-primary/10 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Izračunana razdalja</span>
                    <span className="font-bold text-primary">{rtCalculatedDistance} km</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Število točk</span>
                    <span className="font-medium">{rtWaypoints.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-0.5">
                    <span className="text-muted-foreground">Predvideni čas</span>
                    <span className="font-medium">~{Math.round(rtCalculatedDistance / 60 * 60)} min ({(rtCalculatedDistance / 60).toFixed(1)}h)</span>
                  </div>
                </div>

                {/* Waypoints list */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">Točke poti ({rtWaypoints.length})</label>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {rtWaypoints.map((wp, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded px-2 py-1.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            i === 0 ? 'bg-emerald-500' : i === rtWaypoints.length - 1 ? 'bg-rose-500' : 'bg-primary'
                          }`} />
                          <span className="font-medium">
                            {i === 0 ? 'START' : i === rtWaypoints.length - 1 ? 'CILJ' : `Točka ${i}`}
                          </span>
                          <span className="text-muted-foreground">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Route name & save */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ime poti</label>
                  <Input
                    placeholder={`Krožna pot ${rtDistance}km`}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={saveRoundTrip}>
                  <Save className="size-4 mr-2" />Shrani krožno pot
                </Button>
              </>
            )}
          </div>
        ) : (
          /* ===== MULTI-DAY MODE ===== */
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Calendar className="size-5 text-primary" />Večdnevno potovanje</h2>

            {/* Viewing trip banner */}
            {viewingTrip && (
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-primary">👁️ {viewingTrip.title}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setViewingTrip(null)}>
                    <X className="size-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {viewingTrip.tripDays.length} dni · {viewingTrip.totalDistance} km
                </p>
              </div>
            )}

            {/* Trip details */}
            {!viewingTrip && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Naslov potovanja</label>
                  <Input placeholder="Npr. Po Sloveniji v 3 dneh" value={tripTitle} onChange={e => setTripTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis (opcijsko)</label>
                  <Input placeholder="Kratek opis potovanja..." value={tripDescription} onChange={e => setTripDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Začetek</label>
                    <Input type="date" value={tripStartDate} onChange={e => setTripStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Konec</label>
                    <Input type="date" value={tripEndDate} onChange={e => setTripEndDate(e.target.value)} />
                  </div>
                </div>

                <Separator />

                {/* Day-by-day planner */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">Dnevi ({tripDays.length})</label>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={addDay}>
                      <Plus className="size-3 mr-1" />Dodaj dan
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[45vh]">
                    <div className="space-y-2">
                      {tripDays.map((day, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border transition-all ${
                            activeDay === idx ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-secondary/30'
                          }`}
                        >
                          {/* Day header */}
                          <button
                            className="w-full flex items-center gap-2 p-2.5 text-left"
                            onClick={() => {
                              setActiveDay(idx)
                              setExpandedDay(expandedDay === idx ? null : idx)
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getDayColor(day.dayNumber) }}
                            />
                            <span className="text-sm font-medium flex-1 truncate">{day.title}</span>
                            <span className="text-xs text-muted-foreground">{day.distance} km</span>
                            {tripDays.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); removeDay(idx) }}
                              >
                                <Minus className="size-3" />
                              </Button>
                            )}
                            {expandedDay === idx ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                          </button>

                          {/* Expanded day details */}
                          {expandedDay === idx && (
                            <div className="px-2.5 pb-2.5 space-y-2.5 border-t border-border/30 pt-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Naslov dneva</label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder={`Dan ${day.dayNumber}: Ljubljana - Bled`}
                                  value={day.title}
                                  onChange={e => updateDay(idx, 'title', e.target.value)}
                                />
                              </div>

                              {/* Waypoints */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs text-muted-foreground">Točke ({day.waypoints.length})</label>
                                  {day.waypoints.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-5 text-xs text-destructive" onClick={() => {
                                      const updated = { ...day, waypoints: [], distance: 0, duration: 0, startLat: 46.15, startLng: 14.99, endLat: 46.15, endLng: 14.99 }
                                      setTripDays(prev => { const arr = [...prev]; arr[idx] = updated; return arr })
                                    }}>
                                      <Trash2 className="size-3 mr-1" />Počisti
                                    </Button>
                                  )}
                                </div>
                                {day.waypoints.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2 bg-secondary/30 rounded">
                                    Kliknite na zemljevid za točke tega dne
                                  </p>
                                ) : (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {day.waypoints.map((wp, wi) => (
                                      <div key={wi} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getDayColor(day.dayNumber) }} />
                                          <span>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(idx, wi)}>
                                          <X className="size-2.5" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Notes */}
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">📝 Opombe</label>
                                <Textarea
                                  className="text-xs min-h-[48px]"
                                  placeholder="Npr. Nočitev: Hotel Vila Bled"
                                  value={day.notes}
                                  onChange={e => updateDay(idx, 'notes', e.target.value)}
                                />
                              </div>

                              {/* Accommodation */}
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Hotel className="size-3" /> Namestitev</label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Npr. Hotel Vila Bled"
                                  value={day.accommodation}
                                  onChange={e => updateDay(idx, 'accommodation', e.target.value)}
                                />
                              </div>

                              {/* Fuel stop */}
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`fuel-${idx}`}
                                  checked={day.fuelStop}
                                  onCheckedChange={(checked) => updateDay(idx, 'fuelStop', !!checked)}
                                />
                                <label htmlFor={`fuel-${idx}`} className="text-xs flex items-center gap-1 cursor-pointer">
                                  <Fuel className="size-3" /> Načrtovan postanek za gorivo
                                </label>
                              </div>

                              {/* Day stats */}
                              {day.waypoints.length > 1 && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1.5">
                                  <span>📏 {day.distance} km</span>
                                  <span><Clock className="size-3 inline" /> ~{Math.round(day.duration)} min</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Total stats */}
                {totalTripDistance > 0 && (
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Skupna razdalja</span>
                      <span className="font-bold text-primary">{totalTripDistance} km</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Skupen čas</span>
                      <span className="font-medium">~{Math.round(tripDays.reduce((s, d) => s + d.duration, 0))} min</span>
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={saveTrip} disabled={saving || !tripTitle.trim()}>
                  <Save className="size-4 mr-2" />{saving ? 'Shranjujem...' : 'Shrani potovanje'}
                </Button>
              </>
            )}

            <Separator />

            {/* Saved trips list */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">📂 Shranjena potovanja</h3>
              {savedTrips.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Ni shranjenih potovanj</p>
              ) : (
                <ScrollArea className="max-h-40">
                  <div className="space-y-1.5">
                    {savedTrips.map(trip => (
                      <div
                        key={trip.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                          viewingTrip?.id === trip.id ? 'border-primary/50 bg-primary/5' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                        }`}
                        onClick={() => viewTrip(trip.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{trip.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {trip.days} dni · {trip.totalDistance} km
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); viewTrip(trip.id) }}>
                            <Eye className="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id) }}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
