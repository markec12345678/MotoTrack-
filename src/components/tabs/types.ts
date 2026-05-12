export interface TrackPoint {
  lat: number
  lng: number
  alt: number | null
  timestamp: number
}

export interface RideData {
  id: string
  title: string
  description?: string
  distance: number
  duration: number
  avgSpeed: number
  maxSpeed: number
  elevation: number
  isPublic: boolean
  trackData: string
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  userId: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
}

export interface RouteData {
  id: string
  title: string
  description?: string
  distance: number
  waypoints: string
  routeData: string | null
  category: string
  difficulty: string
  isPublic: boolean
  likes: number
  userId: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
  userLiked?: boolean
}

export interface UserData {
  id: string
  name: string
  email: string
  avatar: string | null
  bike: string | null
  bio: string | null
  stats: {
    totalRides: number
    totalRoutes: number
    totalDistance: number
    totalElevation: number
    avgSpeed: number
  }
}

export interface CommentData {
  id: string
  text: string
  userId: string
  rideId?: string | null
  routeId?: string | null
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
}

export interface WeatherData {
  current: {
    temperature: number
    windspeed: number
    weathercode: number
    description: string
  } | null
  forecast: Array<{
    date: string
    tempMax: number
    tempMin: number
    precipitation: number
    windMax: number
    description: string
  }>
}

export interface LeaderboardUser {
  id: string
  name: string
  avatar: string | null
  bike: string | null
  totalRides: number
  totalRoutes: number
  totalDistance: number
  totalElevation: number
}

export interface PoiData {
  id: string
  name: string
  type: string // gas_station, restaurant, biker_spot, parking, hotel, mechanic
  lat: number
  lng: number
  description: string | null
  rating: number
  createdAt: string
}

export interface AchievementData {
  id: string | null
  type: string
  title: string
  description: string
  icon: string
  earned: boolean
  earnedAt: string | null
}

export type TabId = 'map' | 'plan' | 'track' | 'explore' | 'profile'

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto' }
  return map[cat] || cat
}

export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    scenic: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    twisty: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    offroad: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    city: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  }
  return map[cat] || ''
}

export function difficultyLabel(d: string): string {
  const map: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }
  return map[d] || d
}

export function poiTypeLabel(type: string): string {
  const map: Record<string, string> = {
    gas_station: 'Bencinska črpalka',
    restaurant: 'Restavracija',
    biker_spot: 'Moto srečanje',
    parking: 'Parkirišče',
    hotel: 'Hotel/Namestitev',
    mechanic: 'Servis',
  }
  return map[type] || type
}

export function poiTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    gas_station: '⛽',
    restaurant: '🍽️',
    biker_spot: '🏍️',
    parking: '🅿️',
    hotel: '🏨',
    mechanic: '🔧',
  }
  return map[type] || '📍'
}

export function poiTypeColor(type: string): string {
  const map: Record<string, string> = {
    gas_station: '#22c55e',
    restaurant: '#f59e0b',
    biker_spot: '#ef4444',
    parking: '#3b82f6',
    hotel: '#8b5cf6',
    mechanic: '#f97316',
  }
  return map[type] || '#6b7280'
}
