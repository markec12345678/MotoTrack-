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

export interface CommunityData {
  id: string
  name: string
  description: string | null
  avatar: string | null
  isPublic: boolean
  createdAt: string
  memberCount: number
  rideCount: number
  isMember: boolean
  userRole: string | null
  recentMembers: Array<{ id: string; name: string; avatar: string | null; bike: string | null }>
}

export interface HazardData {
  id: string
  type: string
  name: string
  description: string | null
  lat: number
  lng: number
  createdAt: string
  user?: { id: string; name: string } | null
}

export interface FuelData {
  fuelCapacity: number
  fuelConsumption: number
  currentFuel: number
  range: number
  lastRefuelAt: string | null
}

export interface ParkingData {
  parkedLat: number | null
  parkedLng: number | null
  parkedAt: string | null
  parkedNote: string | null
}

export interface FriendshipData {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'blocked'
  requesterId: string
  addresseeId: string
  friend: {
    id: string
    name: string
    email: string
    avatar: string | null
    bike: string | null
  }
  createdAt: string
}

export interface LiveRider {
  userId: string
  userName: string
  rideId: string | null
  lat: number
  lng: number
  speed: number
  heading: number
  lastUpdate: number
}

export interface NotificationData {
  id: string
  type: 'like' | 'comment' | 'achievement' | 'friend_request' | 'community_join' | 'hazard_nearby'
  title: string
  message: string
  read: boolean
  fromUserId: string | null
  fromUser?: { id: string; name: string; avatar: string | null } | null
  relatedId: string | null
  createdAt: string
}

export interface PhotoData {
  id: string
  url: string
  caption: string | null
  rideId: string | null
  routeId: string | null
  userId: string
  user?: { id: string; name: string; avatar: string | null }
  createdAt: string
}

export interface SosAlertData {
  id: string
  userId: string
  lat: number
  lng: number
  type: 'manual' | 'crash_detected' | 'no_movement'
  status: 'active' | 'resolved' | 'false_alarm'
  message: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface EmergencyContactsData {
  iceName1: string | null
  icePhone1: string | null
  iceName2: string | null
  icePhone2: string | null
  bloodType: string | null
  allergies: string | null
}

export interface ComparisonData {
  rides: Array<{
    id: string
    title: string
    date: string
    distance: number
    duration: number
    avgSpeed: number
    maxSpeed: number
    elevation: number
  }>
  best: {
    distance: number
    duration: number  // lowest is best
    avgSpeed: number
    maxSpeed: number
    elevation: number
  }
}

export interface RoadRatingData {
  id: string
  lat: number
  lng: number
  rating: number
  surface: string
  comment: string | null
  userId: string
  user?: { id: string; name: string; avatar: string | null }
  createdAt: string
}

export interface TripDayData {
  id: string
  dayNumber: number
  title: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  waypoints: string
  distance: number
  duration: number
  notes: string | null
  accommodation: string | null
  fuelStop: boolean
}

export interface TripData {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string
  days: number
  totalDistance: number
  isPublic: boolean
  userId: string
  tripDays: TripDayData[]
  createdAt: string
}

export interface SpeedAlertSettings {
  speedLimit: number
  speedAlertEnabled: boolean
  speedAlertSound: boolean
}

export interface GroupRideParticipantData {
  id: string
  groupRideId: string
  userId: string
  status: 'joined' | 'maybe' | 'declined'
  joinedAt: string
  user: { id: string; name: string; avatar: string | null; bike: string | null }
}

export interface GroupRideData {
  id: string
  title: string
  description: string | null
  creatorId: string
  creator: { id: string; name: string; avatar: string | null; bike: string | null }
  date: string
  meetingLat: number
  meetingLng: number
  meetingPlace: string
  destinationLat: number | null
  destinationLng: number | null
  destinationPlace: string | null
  maxRiders: number
  category: string
  status: string
  createdAt: string
  participants: GroupRideParticipantData[]
}

export interface ExpenseData {
  id: string
  userId: string
  type: string // fuel, maintenance, insurance, parts, toll, parking, other
  amount: number
  date: string
  description: string | null
  mileage: number | null
  createdAt: string
}

export interface MaintenanceReminderData {
  id: string
  userId: string
  type: string // oil_change, tire_change, chain_service, brake_service, filter_change, inspection, custom
  title: string
  nextMileage: number | null
  nextDate: string | null
  intervalKm: number | null
  intervalDays: number | null
  completed: boolean
  completedAt: string | null
  createdAt: string
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
  const map: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto', snowmobile: 'Snežni skuter', racetrack: 'Dirkališče' }
  return map[cat] || cat
}

export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    scenic: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    twisty: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    offroad: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    city: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    snowmobile: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    racetrack: 'bg-red-500/20 text-red-400 border-red-500/30',
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
    camping: 'Kamp',
    viewpoint: 'Razgledna točka',
    snowmobile: 'Snežni skuter',
    racetrack: 'Dirkališče',
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
    camping: '⛺',
    viewpoint: '🏔️',
    snowmobile: '🛷',
    racetrack: '🏁',
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
    camping: '#059669',
    viewpoint: '#0ea5e9',
    snowmobile: '#06b6d4',
    racetrack: '#dc2626',
  }
  return map[type] || '#6b7280'
}

// Feature 1: Turn-by-turn Navigation
export interface NavigationStep {
  instruction: string    // Slovenian instruction text
  type: string           // turn, straight, left, right, slight_left, slight_right, sharp_left, sharp_right, roundabout, arrive
  distance: number       // meters
  duration: number       // seconds
  name: string           // street/road name
  lat: number
  lng: number
  coords?: [number, number]  // [lng, lat] for proximity detection
}

export interface NavigationRoute {
  steps: NavigationStep[]
  totalDistance: number   // meters
  totalDuration: number   // seconds
  geometry: [number, number][]  // [lat, lng] pairs for the full route
}

// Feature 2: Offline Maps
export interface OfflineMapRegion {
  id: string
  name: string
  bounds: { north: number; south: number; east: number; west: number }
  zoomLevels: string
  estimatedSizeMB: number
  downloaded: boolean
}

// Feature 3: Twisty Routing
export interface TwistyRouteResult {
  waypoints: { lat: number; lng: number }[]
  totalDistance: number
  estimatedDuration: number
  twistyScore: number  // 1-10
  geometry: [number, number][]
  curvinessReport: {
    straight: number   // % of route that's straight
    curves: number     // % of route that's curved
    tightCurves: number // % with tight curves
  }
}

// Feature 4: Live Tracking
export interface LiveTrackingSession {
  id: string
  shareToken: string
  shareUrl: string
  isActive: boolean
  startedAt: string
  viewerCount: number
}

export interface LiveTrackingView {
  userName: string
  lat: number
  lng: number
  speed: number
  heading: number
  lastUpdate: string
  isActive: boolean
}

// Feature 5: Crash Detection
export interface CrashEvent {
  id: string
  userId: string
  lat: number
  lng: number
  gForce: number
  speedBefore: number
  detectedAt: string
  alertSent: boolean
  status: 'detected' | 'confirmed' | 'false_alarm'
  notes: string | null
}

// Feature 7: Fuel Prices
export interface FuelStation {
  id: string
  name: string
  lat: number
  lng: number
  distance: number       // km from search point
  prices: {
    '95': number | null
    '98': number | null
    diesel: number | null
  }
  brand: string | null
  address: string | null
}

// Feature 8: Lean Angle
export interface LeanAngleSession {
  id: string
  maxLeanLeft: number
  maxLeanRight: number
  avgLean: number
  duration: number
  createdAt: string
}

// Feature 9: Round Trip
export interface RoundTripResult {
  waypoints: { lat: number; lng: number }[]
  totalDistance: number
  estimatedDuration: number
  geometry: [number, number][]
  twistyScore: number
}

// Feature 11: GPX
export interface GpxImportResult {
  id: string
  fileName: string
  fileSize?: number
  routeCount: number
  trackCount: number
  status: string
  resultData?: string | null
  createdAt?: string
}

// Feature 12: Challenges
export interface ChallengeData {
  id: string
  title: string
  description: string | null
  type: string
  goal: number
  unit: string
  startDate: string
  endDate: string
  isPublic: boolean
  category: string
  icon: string
  points: number
  participantCount: number
  userProgress: number
  userCompleted: boolean
  daysRemaining: number
}

// Feature 14: Traffic
export interface TrafficIncident {
  id: string
  type: string      // construction, accident, delay, closure
  description: string
  lat: number
  lng: number
  severity: string   // low, medium, high
  updatedAt: string
}

// Feature 15: Map Styles
export interface MapStyleConfig {
  styleName: string
  customUrl: string | null
  overlayTraffic: boolean
  overlayWeather: boolean
  overlayHazards: boolean
  overlayPois: boolean
}

// Feature 16: Service Centers
export interface ServiceCenterData {
  id: string
  name: string
  type: string
  brand: string | null
  lat: number
  lng: number
  distance: number
  address: string | null
  phone: string | null
  website: string | null
  rating: number
  services: string[]
}

// Feature 17: Gamification
export interface UserPointsData {
  totalPoints: number
  level: number
  ridesPoints: number
  socialPoints: number
  challengePoints: number
  streakDays: number
  recentTransactions: PointsTransactionData[]
}

export interface PointsTransactionData {
  id: string
  amount: number
  reason: string
  createdAt: string
}

// Feature: Favorites/Bookmarks
export interface FavoriteData {
  id: string
  userId: string
  rideId: string | null
  routeId: string | null
  ride?: RideData | null
  route?: RouteData | null
  createdAt: string
}

// Feature: Social Feed
export interface SocialActivityData {
  id: string
  userId: string
  type: 'ride_completed' | 'route_shared' | 'achievement_earned' | 'challenge_joined' | 'community_joined' | 'group_ride_created' | 'comment_posted' | 'photo_uploaded'
  title: string
  description: string | null
  icon: string
  targetId: string | null
  targetType: 'ride' | 'route' | 'achievement' | 'challenge' | 'community' | 'group_ride' | null
  isPublic: boolean
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
  likes: number
  userLiked: boolean
}

// Feature: Weather Along Route
export interface WaypointWeather {
  lat: number
  lng: number
  temperature: number
  windspeed: number
  weathercode: number
  description: string
  windDirection: number
  precipitation: number
  isWindDangerous: boolean
}

// Feature: Map Style Data (for map-style-switcher)
export interface MapStyleData {
  id: string
  name: string
  tileUrl: string
  attribution?: string
  preview?: string
  isDefault?: boolean
}

// Feature: Traffic Alerts (for traffic-alerts)
export interface TrafficAlertData {
  id: string
  type: string
  title: string
  description: string
  road: string | null
  lat: number
  lng: number
  severity: string
  createdAt: string
  updatedAt: string
}

// Feature: Points/Gamification (for points-panel)
export interface PointsData {
  totalPoints: number
  points: number
  level: number
  levelName: string
  levelProgress: number
  currentLevelMin: number
  nextLevelPoints: number
  ridesPoints: number
  socialPoints: number
  challengePoints: number
  streakDays: number
  streak: { current: number; best: number }
  history: Array<{ id: string; amount: number; reason: string; createdAt: string }>
  leaderboard: Array<{ id: string; name: string; avatar: string | null; points: number; level: number }>
  recentTransactions: PointsTransactionData[]
}

// Feature: Route Sharing
export interface ShareData {
  title: string
  distance: number
  elevation: number
  category?: string
  user: { name: string; avatar: string | null }
  createdAt: string
  shareUrl: string
}

// Balkan Moto Event
export interface MotoEventData {
  id: string
  title: string
  description: string | null
  date: string
  endDate: string | null
  lat: number
  lng: number
  location: string
  country: string
  category: string
  website: string | null
  imageUrl: string | null
  organizerName: string | null
  contactEmail: string | null
  isFeatured: boolean
  createdAt: string
}

// Camp Site
export interface CampSiteData {
  id: string
  name: string
  description: string | null
  lat: number
  lng: number
  country: string
  address: string | null
  phone: string | null
  website: string | null
  email: string | null
  rating: number
  priceRange: string | null
  amenities: string[]
  motoFriendly: boolean
  openSeason: string | null
  imageUrl: string | null
}

// Gradient/Incline Analysis
export interface GradientSegment {
  distance: number       // meters
  elevationGain: number  // meters
  elevationLoss: number  // meters
  gradient: number       // percentage (-100 to 100)
  startIndex: number
  endIndex: number
}

export interface GradientProfile {
  segments: GradientSegment[]
  totalAscent: number     // meters
  totalDescent: number    // meters
  maxGradient: number     // percentage
  minGradient: number     // percentage
  avgGradient: number     // percentage
  steepUphillPct: number  // % of route > 8% uphill
  moderateUphillPct: number // % of route 3-8% uphill
  flatPct: number         // % of route -3% to 3%
  moderateDownhillPct: number // % of route -8% to -3%
  steepDownhillPct: number // % of route < -8% downhill
}

// Weather Alert
export interface WeatherAlert {
  id: string
  type: 'wind' | 'rain' | 'storm' | 'ice' | 'fog' | 'heat' | 'snow'
  severity: 'low' | 'medium' | 'high' | 'extreme'
  title: string
  description: string
  lat: number
  lng: number
  radius: number  // km
  startTime: string
  endTime: string
  source: string
}

// Balkan Motorcycle Road (Butler Maps equivalent)
export interface BalkanMotoRoad {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  difficulty: 'easy' | 'moderate' | 'challenging' | 'extreme'
  roadType: 'asphalt' | 'mixed' | 'gravel'
  lengthKm: number
  country: string
  rating: number  // 1-5
  geometry?: [number, number][]
}
