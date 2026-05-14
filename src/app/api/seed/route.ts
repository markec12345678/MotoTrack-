import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

function interpolatePoints(
  start: [number, number, number],
  end: [number, number, number],
  numPoints: number,
  startTime: number,
  durationMs: number
): [number, number, number, number][] {
  const points: [number, number, number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const lat = start[0] + (end[0] - start[0]) * t
    const lng = start[1] + (end[1] - start[1]) * t
    const alt = start[2] + (end[2] - start[2]) * t + Math.sin(t * Math.PI * 4) * 30
    const ts = startTime + Math.floor(durationMs * t)
    points.push([Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000, Math.round(alt), ts])
  }
  return points
}

function generateTrackData(
  waypoints: [number, number, number][],
  totalDurationSec: number,
  pointsPerSegment: number = 30
): string {
  const startTime = Date.now() - totalDurationSec * 1000
  const segmentDuration = (totalDurationSec * 1000) / (waypoints.length - 1)
  const allPoints: [number, number, number, number][] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const segPoints = interpolatePoints(
      waypoints[i],
      waypoints[i + 1],
      pointsPerSegment,
      startTime + i * segmentDuration,
      segmentDuration
    )
    if (i > 0) segPoints.shift()
    allPoints.push(...segPoints)
  }

  return JSON.stringify(allPoints)
}

export const dynamic = 'force-dynamic'

export async function POST() {
  return seedDatabase()
}

// GET handler removed for security - seed via POST only
// Accidental GET /api/seed could wipe the database

async function seedDatabase() {
  try {
    // Delete existing data in correct order (FK constraints)
    // Use deleteMany which ignores if no records exist
    try { await db.activityLike.deleteMany() } catch {}
    try { await db.achievement.deleteMany() } catch {}
    try { await db.comment.deleteMany() } catch {}
    try { await db.like.deleteMany() } catch {}
    try { await db.poi.deleteMany() } catch {}
    try { await db.hazard.deleteMany() } catch {}
    try { await db.communityMember.deleteMany() } catch {}
    try { await db.ride.deleteMany() } catch {}
    try { await db.route.deleteMany() } catch {}
    try { await db.community.deleteMany() } catch {}
    try { await db.challengeParticipant.deleteMany() } catch {}
    try { await db.challenge.deleteMany() } catch {}
    try { await db.pointsTransaction.deleteMany() } catch {}
    try { await db.userPoints.deleteMany() } catch {}
    try { await db.liveTrackingViewer.deleteMany() } catch {}
    try { await db.liveTrackingSession.deleteMany() } catch {}
    try { await db.crashEvent.deleteMany() } catch {}
    try { await db.leanAngleSession.deleteMany() } catch {}
    try { await db.gpxImport.deleteMany() } catch {}
    try { await db.mapStyleConfig.deleteMany() } catch {}
    try { await db.serviceCenter.deleteMany() } catch {}
    try { await db.socialActivity.deleteMany() } catch {}
    try { await db.expense.deleteMany() } catch {}
    try { await db.maintenanceReminder.deleteMany() } catch {}
    try { await db.friendship.deleteMany() } catch {}
    try { await db.notification.deleteMany() } catch {}
    try { await db.sosAlert.deleteMany() } catch {}
    try { await db.emergencyContact.deleteMany() } catch {}
    try { await db.roadRating.deleteMany() } catch {}
    try { await db.tripDay.deleteMany() } catch {}
    try { await db.trip.deleteMany() } catch {}
    try { await db.groupRideParticipant.deleteMany() } catch {}
    try { await db.groupRide.deleteMany() } catch {}
    try { await db.fuelLog.deleteMany() } catch {}
    try { await db.parkingLog.deleteMany() } catch {}
    try { await db.speedAlertSetting.deleteMany() } catch {}
    try { await db.favorite.deleteMany() } catch {}
    try { await db.user.deleteMany() } catch {}

    // Create demo users
    const users = await Promise.all([
      db.user.create({
        data: {
          name: 'Miran M.',
          email: 'miran@rever.si',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Miran',
          bike: 'BMW R1250GS',
          bio: 'Adventurni motociklist z ljubeznijo do slovenskih gora. Raziskujem alpske prelaze in doline že 15 let.',
        },
      }),
      db.user.create({
        data: {
          name: 'Luka K.',
          email: 'luka@rever.si',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luka',
          bike: 'Yamaha Ténéré 700',
          bio: 'Enduro navdušenec. Vikend izleti po Sloveniji in sosednjih državah so moja strast.',
        },
      }),
      db.user.create({
        data: {
          name: 'Ana S.',
          email: 'ana@rever.si',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana',
          bike: 'Honda CB500X',
          bio: 'Motorkulinatičarka in popotnica. Z motorjem raziskujem okuse in poti po Primorski in Istri.',
        },
      }),
    ])

    // --- RIDES ---
    const ride1Track = generateTrackData(
      [
        [46.0569, 14.5058, 295],
        [46.0833, 14.4333, 320],
        [46.1200, 14.3500, 380],
        [46.1667, 14.2667, 450],
        [46.2167, 14.1833, 480],
        [46.2833, 14.1500, 500],
        [46.3625, 14.0944, 475],
        [46.3450, 14.0500, 510],
        [46.3167, 13.9833, 545],
        [46.2833, 13.9167, 525],
      ],
      5400
    )

    const ride2Track = generateTrackData(
      [
        [46.3625, 14.0944, 475],
        [46.4000, 14.0500, 600],
        [46.4333, 13.9833, 800],
        [46.4500, 13.9000, 1050],
        [46.4333, 13.8000, 1200],
        [46.4167, 13.7500, 1100],
        [46.4000, 13.7000, 900],
        [46.3833, 13.6500, 750],
        [46.3500, 13.6000, 500],
        [46.3317, 13.5536, 440],
      ],
      7200
    )

    const ride3Track = generateTrackData(
      [
        [46.0569, 14.5058, 295],
        [46.0167, 14.4167, 310],
        [45.9500, 14.3500, 340],
        [45.8833, 14.3000, 380],
        [45.8167, 14.2500, 420],
        [45.7833, 14.2167, 510],
        [45.7500, 14.1000, 350],
        [45.6833, 13.9333, 180],
        [45.6000, 13.8000, 60],
        [45.5272, 13.5681, 5],
      ],
      9000
    )

    const ride4Track = generateTrackData(
      [
        [46.0569, 14.5058, 295],
        [46.1000, 14.6000, 280],
        [46.1500, 14.7500, 260],
        [46.2000, 14.9000, 290],
        [46.2500, 15.0500, 310],
        [46.3000, 15.2000, 275],
        [46.3500, 15.3500, 300],
        [46.4000, 15.4500, 320],
        [46.4667, 15.5500, 270],
        [46.5547, 15.6459, 275],
      ],
      7800
    )

    const ride5Track = generateTrackData(
      [
        [46.3317, 13.5536, 440],
        [46.3000, 13.6000, 380],
        [46.2667, 13.6333, 300],
        [46.2333, 13.6500, 250],
        [46.2050, 13.7167, 190],
        [46.1833, 13.7833, 180],
        [46.2000, 13.8500, 250],
        [46.2333, 13.9000, 350],
        [46.2833, 13.9500, 400],
        [46.3317, 13.5536, 440],
      ],
      5400
    )

    const ride6Track = generateTrackData(
      [
        [46.4833, 13.7833, 810],
        [46.4667, 13.7667, 900],
        [46.4500, 13.7500, 1000],
        [46.4333, 13.7333, 1200],
        [46.4167, 13.7000, 1400],
        [46.4000, 13.6667, 1250],
        [46.3833, 13.6333, 900],
        [46.3667, 13.6000, 600],
        [46.3500, 13.5667, 500],
        [46.3333, 13.5333, 460],
      ],
      4800
    )

    const ride7Track = generateTrackData(
      [
        [45.8000, 15.1667, 220],
        [45.7833, 15.1000, 280],
        [45.7500, 15.0333, 380],
        [45.7167, 14.9833, 450],
        [45.7000, 14.9333, 400],
        [45.7167, 14.8667, 300],
        [45.7500, 14.8333, 220],
        [45.7833, 14.9000, 200],
        [45.8000, 15.0000, 210],
        [45.8000, 15.1667, 220],
      ],
      5400
    )

    const ride8Track = generateTrackData(
      [
        [46.0569, 14.5058, 295],
        [46.0667, 14.4333, 320],
        [46.0833, 14.3667, 400],
        [46.1000, 14.3000, 450],
        [46.1167, 14.2333, 380],
        [46.1000, 14.1667, 310],
        [46.0833, 14.2500, 290],
        [46.0667, 14.3500, 280],
        [46.0569, 14.5058, 295],
      ],
      3600
    )

    const ride9Track = generateTrackData(
      [
        [46.2387, 15.2686, 245],
        [46.2667, 15.2000, 310],
        [46.2833, 15.1167, 340],
        [46.3000, 15.0500, 290],
        [46.3167, 14.9833, 270],
        [46.3333, 14.9167, 250],
        [46.3500, 14.8500, 230],
        [46.3667, 14.7833, 225],
        [46.3833, 14.7167, 220],
        [46.4167, 14.6500, 228],
      ],
      4200
    )

    const ride10Track = generateTrackData(
      [
        [46.4333, 13.9000, 630],
        [46.4500, 13.8833, 700],
        [46.4667, 13.8500, 780],
        [46.4833, 13.8167, 880],
        [46.4667, 13.7833, 970],
        [46.4500, 13.7500, 1050],
        [46.4333, 13.7333, 950],
        [46.4167, 13.7667, 820],
        [46.4333, 13.8333, 700],
        [46.4333, 13.9000, 630],
      ],
      3600
    )

    const ridesData = [
      {
        title: 'Ljubljana do Bohinja',
        description: 'Čudovita vožnja iz Ljubljane čez Gorenjsko do Blejskega jezera in naprej do Bohinja. Cesta vodi skozi zasnežene Alpe s čudovitimi razgledi.',
        distance: 65.4,
        duration: 5400,
        avgSpeed: 43.6,
        maxSpeed: 89.2,
        elevation: 680,
        isPublic: true,
        isLive: false,
        trackData: ride1Track,
        startLat: 46.0569,
        startLng: 14.5058,
        endLat: 46.2833,
        endLng: 13.9167,
        userId: users[0].id,
      },
      {
        title: 'Bled do Soške doline',
        description: 'Episká vožnja od Blejskega jezera čez Vršič do Bovca v Soški dolini. Prelaz Vršič nudi 50 klancev in osupljive razglede na Julijske Alpe.',
        distance: 78.2,
        duration: 7200,
        avgSpeed: 39.1,
        maxSpeed: 76.5,
        elevation: 1450,
        isPublic: true,
        isLive: false,
        trackData: ride2Track,
        startLat: 46.3625,
        startLng: 14.0944,
        endLat: 46.3317,
        endLng: 13.5536,
        userId: users[1].id,
      },
      {
        title: 'Obala - Ljubljana do Pirana',
        description: 'Slovenska obala v vsem sijaju! Iz Ljubljane čez Postojnsko jamo do Pirana. Cesta se spušča od planote do modrega Jadrana.',
        distance: 128.5,
        duration: 9000,
        avgSpeed: 51.4,
        maxSpeed: 102.3,
        elevation: 520,
        isPublic: true,
        isLive: false,
        trackData: ride3Track,
        startLat: 46.0569,
        startLng: 14.5058,
        endLat: 45.5272,
        endLng: 13.5681,
        userId: users[2].id,
      },
      {
        title: 'Štajerska avtocesta do Maribora',
        description: 'Hitra vožnja po Štajerski od Ljubljane do Maribora. Ravninska cesta skozi vinorodne griče in polja.',
        distance: 112.3,
        duration: 7800,
        avgSpeed: 51.8,
        maxSpeed: 118.7,
        elevation: 180,
        isPublic: true,
        isLive: false,
        trackData: ride4Track,
        startLat: 46.0569,
        startLng: 14.5058,
        endLat: 46.5547,
        endLng: 15.6459,
        userId: users[0].id,
      },
      {
        title: 'Soška zanka - Bovec Kobarid Tolmin',
        description: 'Krožna vožnja po Soški dolini. Kristalno čista reka Soča vas spremlja ves čas. Idealna za vroče poletne dni.',
        distance: 52.7,
        duration: 5400,
        avgSpeed: 35.1,
        maxSpeed: 72.4,
        elevation: 460,
        isPublic: true,
        isLive: false,
        trackData: ride5Track,
        startLat: 46.3317,
        startLng: 13.5536,
        endLat: 46.3317,
        endLng: 13.5536,
        userId: users[1].id,
      },
      {
        title: 'Vršič - Kranjska Gora do Trente',
        description: 'Legendarni prelaz Vršič s 50 serpentinskimi klanci. Ena najzahtevnejših in najlepših cest v Sloveniji.',
        distance: 38.5,
        duration: 4800,
        avgSpeed: 28.9,
        maxSpeed: 65.1,
        elevation: 1680,
        isPublic: true,
        isLive: false,
        trackData: ride6Track,
        startLat: 46.4833,
        startLng: 13.7833,
        endLat: 46.3333,
        endLng: 13.5333,
        userId: users[0].id,
      },
      {
        title: 'Gorjanci in Krška dolina',
        description: 'Zavita vožnja po Gorjancih in dolini reke Krke. Vinske ceste in termalna mesta so ob poti.',
        distance: 68.9,
        duration: 5400,
        avgSpeed: 45.9,
        maxSpeed: 84.3,
        elevation: 540,
        isPublic: true,
        isLive: false,
        trackData: ride7Track,
        startLat: 45.8000,
        startLng: 15.1667,
        endLat: 45.8000,
        endLng: 15.1667,
        userId: users[2].id,
      },
      {
        title: 'Ljubljanski vikend izlet',
        description: 'Kratek in sladek izlet iz Ljubljane po okoliških gričih. Idealno za sprostitev po napornem tednu.',
        distance: 32.1,
        duration: 3600,
        avgSpeed: 32.1,
        maxSpeed: 68.9,
        elevation: 320,
        isPublic: true,
        isLive: false,
        trackData: ride8Track,
        startLat: 46.0569,
        startLng: 14.5058,
        endLat: 46.0569,
        endLng: 14.5058,
        userId: users[0].id,
      },
      {
        title: 'Celje do Ptuja po vinorodni poti',
        description: 'Vožnja skozi Štajersko vinorodno pokrajino od Celja do Ptuja. Vinogradi in termalna mesta ob cesti.',
        distance: 48.6,
        duration: 4200,
        avgSpeed: 41.6,
        maxSpeed: 78.5,
        elevation: 280,
        isPublic: true,
        isLive: false,
        trackData: ride9Track,
        startLat: 46.2387,
        startLng: 15.2686,
        endLat: 46.4167,
        endLng: 14.6500,
        userId: users[1].id,
      },
      {
        title: 'Triglavska avantura - Vrata',
        description: 'Zahtevna enduro vožnja v Triglavskem narodnem parku. Dostop do doline Vrata s čudovitim pogledom na Triglav.',
        distance: 28.3,
        duration: 3600,
        avgSpeed: 28.3,
        maxSpeed: 55.2,
        elevation: 980,
        isPublic: true,
        isLive: false,
        trackData: ride10Track,
        startLat: 46.4333,
        startLng: 13.9000,
        endLat: 46.4333,
        endLng: 13.9000,
        userId: users[1].id,
      },
    ]

    const rides = await Promise.all(
      ridesData.map((ride) => db.ride.create({ data: ride }))
    )

    // --- ROUTES ---
    const routesData = [
      {
        title: 'Julijske Alpe - Velika gorska zanka',
        description: 'Najlepša gorska pot v Sloveniji. Od Kranjske Gore čez Vršič, dol po Soški dolini in nazaj čez Predel do Trbiža. Več kot 2000m višinske razlike.',
        distance: 156.8,
        waypoints: JSON.stringify([
          { lat: 46.4833, lng: 13.7833 },
          { lat: 46.4333, lng: 13.7333 },
          { lat: 46.3833, lng: 13.6333 },
          { lat: 46.3317, lng: 13.5536 },
          { lat: 46.2333, lng: 13.5667 },
          { lat: 46.2000, lng: 13.5833 },
          { lat: 46.2333, lng: 13.7333 },
          { lat: 46.3500, lng: 13.7500 },
          { lat: 46.4333, lng: 13.8000 },
          { lat: 46.4833, lng: 13.7833 },
        ]),
        routeData: JSON.stringify([
          [46.4833, 13.7833], [46.4667, 13.7667], [46.4500, 13.7500],
          [46.4333, 13.7333], [46.4167, 13.7000], [46.4000, 13.6667],
          [46.3833, 13.6333], [46.3667, 13.6000], [46.3500, 13.5667],
          [46.3317, 13.5536], [46.3000, 13.5667], [46.2667, 13.5833],
          [46.2333, 13.5667], [46.2000, 13.5833], [46.2167, 13.6500],
          [46.2333, 13.7333], [46.2833, 13.7500], [46.3500, 13.7500],
          [46.4000, 13.7833], [46.4333, 13.8000], [46.4667, 13.7833],
          [46.4833, 13.7833],
        ]),
        category: 'scenic',
        difficulty: 'hard',
        isPublic: true,
        likes: 42,
        userId: users[0].id,
      },
      {
        title: 'Slovenska obala - Koprsko primorje',
        description: 'Obalna vožnja od Kopra do Pirana in nazaj. Mediteranski duh, oljčni nasadi in sprošujoči poobedni kavč ob morju.',
        distance: 45.2,
        waypoints: JSON.stringify([
          { lat: 45.5481, lng: 13.7300 },
          { lat: 45.5500, lng: 13.6500 },
          { lat: 45.5400, lng: 13.6000 },
          { lat: 45.5272, lng: 13.5681 },
          { lat: 45.5100, lng: 13.5500 },
          { lat: 45.5272, lng: 13.5681 },
          { lat: 45.5481, lng: 13.7300 },
        ]),
        routeData: JSON.stringify([
          [45.5481, 13.7300], [45.5500, 13.7000], [45.5500, 13.6500],
          [45.5400, 13.6000], [45.5272, 13.5681], [45.5100, 13.5500],
          [45.5272, 13.5681], [45.5400, 13.6000], [45.5500, 13.6500],
          [45.5481, 13.7300],
        ]),
        category: 'scenic',
        difficulty: 'easy',
        isPublic: true,
        likes: 35,
        userId: users[2].id,
      },
      {
        title: 'Zavite ceste Pohorja',
        description: 'Zavite gozdne ceste na Pohorju nad Mariborom. Idealno za tiste, ki iščejo klance in krivulje brez prometa.',
        distance: 62.4,
        waypoints: JSON.stringify([
          { lat: 46.5547, lng: 15.6459 },
          { lat: 46.5333, lng: 15.6000 },
          { lat: 46.5000, lng: 15.5500 },
          { lat: 46.4667, lng: 15.5000 },
          { lat: 46.4500, lng: 15.5333 },
          { lat: 46.4667, lng: 15.6000 },
          { lat: 46.5547, lng: 15.6459 },
        ]),
        routeData: JSON.stringify([
          [46.5547, 15.6459], [46.5333, 15.6000], [46.5000, 15.5500],
          [46.4667, 15.5000], [46.4500, 15.5333], [46.4667, 15.6000],
          [46.5167, 15.6333], [46.5547, 15.6459],
        ]),
        category: 'twisty',
        difficulty: 'medium',
        isPublic: true,
        likes: 28,
        userId: users[1].id,
      },
      {
        title: 'Off-road Logarska dolina',
        description: 'Enduro pot do Logarske doline. Makadamske ceste skozi gozdove in pašnike z osupljivim pogledom na Savinjske Alpe.',
        distance: 41.7,
        waypoints: JSON.stringify([
          { lat: 46.4333, lng: 14.6333 },
          { lat: 46.4333, lng: 14.5500 },
          { lat: 46.4167, lng: 14.4833 },
          { lat: 46.4000, lng: 14.4167 },
          { lat: 46.3833, lng: 14.3667 },
        ]),
        routeData: JSON.stringify([
          [46.4333, 14.6333], [46.4333, 14.5833], [46.4333, 14.5500],
          [46.4167, 14.4833], [46.4000, 14.4167], [46.3833, 14.3667],
        ]),
        category: 'offroad',
        difficulty: 'hard',
        isPublic: true,
        likes: 19,
        userId: users[1].id,
      },
      {
        title: 'Ljubljanski barjanski obhod',
        description: 'Sprošujoča vožnja po Ljubljanskem barju. Ravna in mirna cesta, primerna za začetnike in tiste, ki želijo uživati v naravi.',
        distance: 35.8,
        waypoints: JSON.stringify([
          { lat: 46.0569, lng: 14.5058 },
          { lat: 46.0333, lng: 14.4667 },
          { lat: 46.0167, lng: 14.4167 },
          { lat: 46.0000, lng: 14.3667 },
          { lat: 46.0167, lng: 14.3167 },
          { lat: 46.0333, lng: 14.3667 },
          { lat: 46.0500, lng: 14.4333 },
          { lat: 46.0569, lng: 14.5058 },
        ]),
        routeData: JSON.stringify([
          [46.0569, 14.5058], [46.0333, 14.4667], [46.0167, 14.4167],
          [46.0000, 14.3667], [46.0167, 14.3167], [46.0333, 14.3667],
          [46.0500, 14.4333], [46.0569, 14.5058],
        ]),
        category: 'city',
        difficulty: 'easy',
        isPublic: true,
        likes: 12,
        userId: users[2].id,
      },
      {
        title: 'Panonska ravnina - Murska Sobota',
        description: 'Ravna in hitra cesta čez Pomurje od Maribora do Murske Sobote. Odprta polja in termalna letovišča.',
        distance: 88.3,
        waypoints: JSON.stringify([
          { lat: 46.5547, lng: 15.6459 },
          { lat: 46.6000, lng: 15.7500 },
          { lat: 46.6333, lng: 15.8500 },
          { lat: 46.6500, lng: 15.9500 },
          { lat: 46.6500, lng: 16.0500 },
          { lat: 46.6583, lng: 16.1667 },
        ]),
        routeData: JSON.stringify([
          [46.5547, 15.6459], [46.6000, 15.7500], [46.6333, 15.8500],
          [46.6500, 15.9500], [46.6500, 16.0500], [46.6583, 16.1667],
        ]),
        category: 'scenic',
        difficulty: 'easy',
        isPublic: true,
        likes: 8,
        userId: users[0].id,
      },
    ]

    const routes = await Promise.all(
      routesData.map((route) => db.route.create({ data: route }))
    )

    // --- COMMENTS ---
    const commentsData = [
      {
        text: 'Najlepša vožnja letos! Vršič je vedno poseben, ampak ta pot od Bleda je nekaj posebnega.',
        userId: users[0].id,
        rideId: rides[1].id,
      },
      {
        text: 'Tale vožnja po obali je res sanje. Pri Piranu sem si vzel čas za morske sadeže 🦐',
        userId: users[1].id,
        rideId: rides[2].id,
      },
      {
        text: 'Soča je kristalno čista, sem se ustavil za plavanje pri Bovcu!',
        userId: users[2].id,
        rideId: rides[4].id,
      },
      {
        text: 'Ta gorska zanka je absolutni vrhunec! Priporočam vsem, ki imate izkušnje z gorskimi cestami.',
        userId: users[2].id,
        routeId: routes[0].id,
      },
      {
        text: 'Obalna ruta je super za poletne večere. Zelo sproščujoča in mediteranska.',
        userId: users[0].id,
        routeId: routes[1].id,
      },
      {
        text: 'Pohorje je zaklad zavitih cest. Malo prometa, veliko užitka!',
        userId: users[0].id,
        routeId: routes[2].id,
      },
      {
        text: 'Logarska dolina off-road je zahtevna ampak čudovita. Potrebuješ enduro moto!',
        userId: users[2].id,
        routeId: routes[3].id,
      },
      {
        text: 'Ljubljanski barjanski obhod je odličen za začetnike. Jaz ga vozim vsak vikend za sprostitev.',
        userId: users[1].id,
        routeId: routes[4].id,
      },
    ]

    const comments = await Promise.all(
      commentsData.map((comment) => db.comment.create({ data: comment }))
    )

    // --- LIKES ---
    // 12 likes spread across routes from different users
    const likesData = [
      // Route 0 (Julijske Alpe) - liked by all 3 users
      { userId: users[0].id, routeId: routes[0].id },
      { userId: users[1].id, routeId: routes[0].id },
      { userId: users[2].id, routeId: routes[0].id },
      // Route 1 (Slovenska obala) - liked by 2 users
      { userId: users[0].id, routeId: routes[1].id },
      { userId: users[1].id, routeId: routes[1].id },
      // Route 2 (Pohorje) - liked by all 3 users
      { userId: users[0].id, routeId: routes[2].id },
      { userId: users[1].id, routeId: routes[2].id },
      { userId: users[2].id, routeId: routes[2].id },
      // Route 3 (Logarska dolina) - liked by 2 users
      { userId: users[1].id, routeId: routes[3].id },
      { userId: users[2].id, routeId: routes[3].id },
      // Route 4 (Ljubljanski barje) - liked by 1 user
      { userId: users[2].id, routeId: routes[4].id },
      // Route 5 (Panonska ravnina) - liked by 3 users
      { userId: users[0].id, routeId: routes[5].id },
      { userId: users[1].id, routeId: routes[5].id },
      { userId: users[2].id, routeId: routes[5].id },
    ]

    const likes = await Promise.all(
      likesData.map((like) => db.like.create({ data: like }))
    )

    // --- POIS ---
    const poisData = [
      // Ljubljana area
      { name: 'Petrol Ljubljana Center', type: 'gas_station', lat: 46.0569, lng: 14.5058, description: 'Bencinska črpalka v središču Ljubljane. 24/7 odprto.', rating: 4.2 },
      { name: 'Restavracija As', type: 'restaurant', lat: 46.0510, lng: 14.5060, description: 'Priljubljena restavracija z lokalno hrano v Ljubljani.', rating: 4.5 },
      { name: 'Moto srečanje Rožnik', type: 'biker_spot', lat: 46.0580, lng: 14.4800, description: 'Priljubljeno srečanje motoristov ob nedeljah na Rožniku.', rating: 4.7 },
      { name: 'Parkirišče BTC City', type: 'parking', lat: 46.0680, lng: 14.5400, description: 'Brezplačno parkirišče z varstvom pri BTC City.', rating: 3.8 },
      { name: 'Hotel Park Ljubljana', type: 'hotel', lat: 46.0550, lng: 14.5100, description: 'Srednjevelik hotel v centru Ljubljane z garažo za moto.', rating: 4.1 },
      { name: 'Moto servis Ljubljana', type: 'mechanic', lat: 46.0620, lng: 14.5200, description: 'Avtorizirani servis BMW in Yamaha motociklov.', rating: 4.6 },
      // Bled area
      { name: 'OMV Bled', type: 'gas_station', lat: 46.3625, lng: 14.0944, description: 'Bencinska črpalka ob cesti proti Bledu.', rating: 4.0 },
      { name: 'Restavracija Blejski grad', type: 'restaurant', lat: 46.3690, lng: 14.0930, description: 'Restavracija z razgledom na Blejski jezero in grad.', rating: 4.8 },
      { name: 'Moto srečanje Bled', type: 'biker_spot', lat: 46.3600, lng: 14.0850, description: 'Zbirno mesto motoristov ob Blejskem jezeru.', rating: 4.5 },
      { name: 'Hotel Vila Bled', type: 'hotel', lat: 46.3570, lng: 14.0890, description: 'Luksuzni hotel ob Blejskem jezeru s čudovitim razgledom.', rating: 4.9 },
      // Soča valley
      { name: 'Petrol Bovec', type: 'gas_station', lat: 46.3317, lng: 13.5536, description: 'Edina bencinska črpalka v Bovcu. Pomembna postaja za Soško dolino.', rating: 3.9 },
      { name: 'Restavracija Soča', type: 'restaurant', lat: 46.3350, lng: 13.5600, description: 'Domača hrana ob reki Soči. Soška postrvlj je specialiteta.', rating: 4.6 },
      { name: 'Moto srečanje Bovec', type: 'biker_spot', lat: 46.3300, lng: 13.5500, description: 'Letno mednarodno moto srečanje v Bovcu. Avgust vsako leto.', rating: 4.9 },
      { name: 'Parkirišče Trenta', type: 'parking', lat: 46.3740, lng: 13.7250, description: 'Parkirišče v Trenti, izhodišče za pohode v Triglavski narodni park.', rating: 4.0 },
      // Coast
      { name: 'OMV Koper', type: 'gas_station', lat: 45.5481, lng: 13.7300, description: 'Bencinska črpalka ob vhodu v Koper.', rating: 4.1 },
      { name: 'Restavracija Piran', type: 'restaurant', lat: 45.5272, lng: 13.5681, description: 'Morska restavracija v Piranu s svežimi sadeži.', rating: 4.7 },
      { name: 'Hotel Kempinski Palanga', type: 'hotel', lat: 45.5150, lng: 13.5900, description: 'Boutique hotel na slovenski obali z mediteranskim duhom.', rating: 4.4 },
      // Other locations
      { name: 'Moto servis Maribor', type: 'mechanic', lat: 46.5547, lng: 15.6459, description: 'Splošni moto servis v Mariboru. Hitra pomoč na cesti.', rating: 4.3 },
      { name: 'Parkirišče Vršič', type: 'parking', lat: 46.4333, lng: 13.7333, description: 'Parkirišče na prelazu Vršič. Odlično izhodišče za okoliške ture.', rating: 4.2 },
    ]

    const pois = await Promise.all(
      poisData.map((poi) => db.poi.create({ data: poi }))
    )

    // --- ACHIEVEMENTS ---
    const achievementsData = [
      { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: users[0].id },
      { type: 'hiker', title: 'Pohodnik', description: 'Zaključili ste 10 voženj!', icon: '🥾', userId: users[0].id },
      { type: 'long_distance', title: 'Dolge razdalje', description: 'Prevozili ste 500 km skupaj!', icon: '🛣️', userId: users[0].id },
      { type: 'mountain_cossack', title: 'Gorski kozak', description: 'Prevozili ste 5000m višine skupaj!', icon: '⛰️', userId: users[1].id },
      { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: users[1].id },
      { type: 'speed_demon', title: 'Hitrostni demon', description: 'Dosegli ste hitrost nad 120 km/h!', icon: '⚡', userId: users[2].id },
      { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️', userId: users[2].id },
    ]

    const achievements = await Promise.all(
      achievementsData.map((a) => db.achievement.create({ data: a }))
    )

    // --- COMMUNITIES ---
    const communitiesData = [
      { name: 'Alpski motoristi', description: 'Skupnost motoristov, ki obožujejo gorske prelaze in alpske ceste. Skupna vožnja vsako soboto!', avatar: '🏔️', isPublic: true },
      { name: 'Soški jezdecí', description: 'Motoristi Soške doline. Organiziramo skupne ture po Julijskih Alpah in ob reki Soči.', avatar: '🌊', isPublic: true },
      { name: 'Obalni rajderji', description: 'Primorski motoristi - obala, mediteranski duh in sproščene vožnje po slovenski rivieri.', avatar: '🏖️', isPublic: true },
      { name: 'Enduro Slovenija', description: 'Skupina za enduro in off-road navdušence. Makadamske ceste in gozdne poti so naše igrišče.', avatar: '🏍️', isPublic: true },
      { name: 'Nočni jezdecí Ljubljana', description: 'Za tiste, ki raje vozijo, ko se mesti umirijo. Nočne vožnje in kavarna ob polnoči.', avatar: '🌙', isPublic: true },
    ]

    const communities = await Promise.all(
      communitiesData.map((c) => db.community.create({ data: c }))
    )

    // Add users as community members
    const communityMembersData = [
      // Alpski motoristi
      { userId: users[0].id, communityId: communities[0].id, role: 'admin' },
      { userId: users[1].id, communityId: communities[0].id, role: 'member' },
      { userId: users[2].id, communityId: communities[0].id, role: 'member' },
      // Soški jezdecí
      { userId: users[1].id, communityId: communities[1].id, role: 'admin' },
      { userId: users[0].id, communityId: communities[1].id, role: 'member' },
      // Obalni rajderji
      { userId: users[2].id, communityId: communities[2].id, role: 'admin' },
      { userId: users[0].id, communityId: communities[2].id, role: 'moderator' },
      { userId: users[1].id, communityId: communities[2].id, role: 'member' },
      // Enduro Slovenija
      { userId: users[1].id, communityId: communities[3].id, role: 'admin' },
      { userId: users[0].id, communityId: communities[3].id, role: 'member' },
      // Nočni jezdecí
      { userId: users[0].id, communityId: communities[4].id, role: 'admin' },
      { userId: users[2].id, communityId: communities[4].id, role: 'member' },
    ]

    const communityMembers = await Promise.all(
      communityMembersData.map((m) => db.communityMember.create({ data: m }))
    )

    // --- HAZARDS (from DB) ---
    const hazardsData = [
      { type: 'speed_camera', name: 'Hitrostna past Ljubljana', description: 'Hitrostna kamera na Ljubljanski obvoznici', lat: 46.0750, lng: 14.5300, userId: users[0].id },
      { type: 'speed_camera', name: 'Hitrostna past Maribor', description: 'Hitrostna kamera na Mariborski obvoznici', lat: 46.5400, lng: 15.6200, userId: users[1].id },
      { type: 'rockfall', name: 'Plazovito območje Vršič', description: 'Nevarnost padanja kamenja spomladi', lat: 46.4400, lng: 13.7200 },
      { type: 'slippery', name: 'Zdrsna cesta Predel', description: 'Nevarnost zdrsa pri mrazu', lat: 46.3850, lng: 13.5600 },
      { type: 'wildlife', name: 'Divjad Soška dolina', description: 'Pogost prehod divjadi čez cesto', lat: 46.3200, lng: 13.6000 },
      { type: 'slippery', name: 'Zdrsna cesta Mangart', description: 'Izjemno drsna cesta pri mokri podlagi', lat: 46.4550, lng: 13.6400 },
      { type: 'construction', name: 'Delnice na Gorenjski', description: 'Cesta v popravilu - zavozljivo', lat: 46.2000, lng: 14.2000 },
      { type: 'speed_limit', name: 'Omejitev 30 Ljubljana center', description: 'Omejitev hitrosti 30 km/h', lat: 46.0500, lng: 14.5050 },
    ]

    const hazards = await Promise.all(
      hazardsData.map((h) => db.hazard.create({ data: h }))
    )

    // --- CHALLENGES ---
    const now = new Date()
    const challengesData = [
      { title: 'Mesečni km', description: 'Prevozite 500 km ta mesec!', type: 'distance', goal: 500, unit: 'km', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0), category: 'monthly', icon: '🛣️', points: 200, creatorId: users[0].id },
      { title: 'Vikend bojevnik', description: 'Zaključite 5 voženj ta teden!', type: 'rides', goal: 5, unit: 'voženj', startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6), category: 'weekly', icon: '⚡', points: 100, creatorId: users[1].id },
      { title: 'Alpski osvajalec', description: 'Premejajte 3000m višine ta mesec!', type: 'elevation', goal: 3000, unit: 'm', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0), category: 'monthly', icon: '⛰️', points: 300, creatorId: users[0].id },
      { title: 'Veriga dni', description: 'Vozite 7 dni zapored!', type: 'streak', goal: 7, unit: 'dni', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0), category: 'monthly', icon: '🔥', points: 250, creatorId: users[2].id },
      { title: 'Hitrostni kralj', description: 'Dosezite povprečno hitrost nad 60km/h na 3 vožnjah!', type: 'speed', goal: 3, unit: 'voženj', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0), category: 'monthly', icon: '🏎️', points: 150, creatorId: users[1].id },
    ]

    const challenges = await Promise.all(
      challengesData.map((c) => db.challenge.create({ data: c }))
    )

    // Add challenge participants with some progress
    await db.challengeParticipant.createMany({
      data: [
        { challengeId: challenges[0].id, userId: users[0].id, progress: 347 },
        { challengeId: challenges[0].id, userId: users[1].id, progress: 215 },
        { challengeId: challenges[1].id, userId: users[0].id, progress: 3 },
        { challengeId: challenges[2].id, userId: users[1].id, progress: 1800 },
        { challengeId: challenges[3].id, userId: users[2].id, progress: 4 },
        { challengeId: challenges[4].id, userId: users[0].id, progress: 1 },
      ]
    })

    // --- USER POINTS ---
    await db.userPoints.createMany({
      data: [
        { userId: users[0].id, totalPoints: 1250, ridesPoints: 800, socialPoints: 250, challengePoints: 200, streakDays: 4, level: 3 },
        { userId: users[1].id, totalPoints: 890, ridesPoints: 500, socialPoints: 190, challengePoints: 200, streakDays: 2, level: 2 },
        { userId: users[2].id, totalPoints: 640, ridesPoints: 400, socialPoints: 140, challengePoints: 100, streakDays: 4, level: 2 },
      ]
    })

    // Points transactions
    await db.pointsTransaction.createMany({
      data: [
        { userId: users[0].id, amount: 100, reason: 'ride_completed' },
        { userId: users[0].id, amount: 50, reason: 'social_share' },
        { userId: users[0].id, amount: 200, reason: 'challenge_won' },
        { userId: users[1].id, amount: 100, reason: 'ride_completed' },
        { userId: users[1].id, amount: 200, reason: 'challenge_won' },
        { userId: users[2].id, amount: 100, reason: 'ride_completed' },
        { userId: users[2].id, amount: 50, reason: 'social_share' },
      ]
    })

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        users: users.length,
        rides: rides.length,
        routes: routes.length,
        comments: comments.length,
        likes: likes.length,
        pois: pois.length,
        achievements: achievements.length,
        communities: communities.length,
        communityMembers: communityMembers.length,
        hazards: hazards.length,
        challenges: challenges.length,
      },
    })
  } catch (error: any) {
    console.error('Seed error:', error?.message || error, error?.stack || '')
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to seed database' },
      { status: 500 }
    )
  }
}
