import { db } from '@/lib/db'
import { notifyAchievement } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// All possible achievements
const ALL_ACHIEVEMENTS = [
  { type: 'first_ride', title: 'Prva vožnja', description: 'Zaključili ste prvo vožnjo!', icon: '🏍️' },
  { type: 'hiker', title: 'Pohodnik', description: 'Zaključili ste 10 voženj!', icon: '🥾' },
  { type: 'long_distance', title: 'Dolge razdalje', description: 'Prevozili ste 500 km skupaj!', icon: '🛣️' },
  { type: 'mountain_cossack', title: 'Gorski kozak', description: 'Prevozili ste 5000m višine skupaj!', icon: '⛰️' },
  { type: 'explorer', title: 'Raziskovalec', description: 'Obiskali ste 5 različnih regij!', icon: '🗺️' },
  { type: 'speed_demon', title: 'Hitrostni demon', description: 'Dosegli ste hitrost nad 120 km/h!', icon: '⚡' },
  { type: 'loyal_rider', title: 'Zvesti motorist', description: 'Aktivni 30 dni!', icon: '📅' },
  { type: 'traveler', title: 'Potnik', description: 'Zaključili ste 5 različnih poti!', icon: '🎒' },
  { type: 'community_member', title: 'Skupnostni član', description: 'Objavili ste 10 komentarjev!', icon: '💬' },
  { type: 'popular', title: 'Priljubljen', description: 'Dosegli ste 20 všečkov na poteh!', icon: '⭐' },
]

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    const earned = await db.achievement.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    })

    // Return all achievements with earned status
    const all = ALL_ACHIEVEMENTS.map(a => {
      const e = earned.find(er => er.type === a.type)
      return {
        ...a,
        earned: !!e,
        earnedAt: e?.earnedAt || null,
        id: e?.id || null,
      }
    })

    return NextResponse.json({ data: all })
  } catch (error) {
    console.error('Achievements fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dosežkov' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Manjka userId' }, { status: 400 })
    }

    // Fetch user stats
    const rides = await db.ride.findMany({ where: { userId } })
    const routes = await db.route.findMany({ where: { userId } })
    const comments = await db.comment.findMany({ where: { userId } })

    const totalRides = rides.length
    const totalDistance = rides.reduce((sum, r) => sum + r.distance, 0)
    const totalElevation = rides.reduce((sum, r) => sum + r.elevation, 0)
    const maxSpeed = rides.reduce((max, r) => Math.max(max, r.maxSpeed), 0)
    const totalRoutes = routes.length
    const totalComments = comments.length
    const totalRouteLikes = routes.reduce((sum, r) => sum + r.likes, 0)

    // Check which achievements should be awarded
    const checks: Record<string, boolean> = {
      first_ride: totalRides >= 1,
      hiker: totalRides >= 10,
      long_distance: totalDistance >= 500,
      mountain_cossack: totalElevation >= 5000,
      explorer: totalRides >= 5, // simplified: 5 rides = 5 regions proxy
      speed_demon: maxSpeed >= 120,
      loyal_rider: totalRides >= 5, // simplified proxy
      traveler: totalRoutes >= 5,
      community_member: totalComments >= 10,
      popular: totalRouteLikes >= 20,
    }

    // Get already earned
    const earned = await db.achievement.findMany({ where: { userId } })
    const earnedTypes = new Set(earned.map(e => e.type))

    // Award new achievements
    const newlyEarned = []
    for (const [type, condition] of Object.entries(checks)) {
      if (condition && !earnedTypes.has(type)) {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.type === type)
        if (achievement) {
          const created = await db.achievement.create({
            data: {
              type: achievement.type,
              title: achievement.title,
              description: achievement.description,
              icon: achievement.icon,
              userId,
            },
          })
          newlyEarned.push(created)
          // Send notification for the new achievement
          notifyAchievement(userId, achievement.title, achievement.icon).catch(() => {})
        }
      }
    }

    return NextResponse.json({
      data: {
        newlyEarned,
        totalEarned: earned.length + newlyEarned.length,
      },
    })
  } catch (error) {
    console.error('Achievement check error:', error)
    return NextResponse.json({ error: 'Napaka pri preverjanju dosežkov' }, { status: 500 })
  }
}
