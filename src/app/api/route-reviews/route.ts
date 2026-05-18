import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/route-reviews — List reviews for a route
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const routeId = searchParams.get('routeId')

    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 })
    }

    const reviews = await db.routeReview.findMany({
      where: { routeId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate averages
    const totalReviews = reviews.length
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0
    const avgRoadQuality = totalReviews > 0
      ? reviews.filter(r => r.roadQuality !== null).reduce((sum, r) => sum + (r.roadQuality ?? 0), 0) / Math.max(reviews.filter(r => r.roadQuality !== null).length, 1)
      : 0
    const avgScenery = totalReviews > 0
      ? reviews.filter(r => r.scenery !== null).reduce((sum, r) => sum + (r.scenery ?? 0), 0) / Math.max(reviews.filter(r => r.scenery !== null).length, 1)
      : 0
    const avgTwistiness = totalReviews > 0
      ? reviews.filter(r => r.twistiness !== null).reduce((sum, r) => sum + (r.twistiness ?? 0), 0) / Math.max(reviews.filter(r => r.twistiness !== null).length, 1)
      : 0
    const avgDifficulty = totalReviews > 0
      ? reviews.filter(r => r.difficulty !== null).reduce((sum, r) => sum + (r.difficulty ?? 0), 0) / Math.max(reviews.filter(r => r.difficulty !== null).length, 1)
      : 0

    // Rating distribution
    const distribution = [0, 0, 0, 0, 0]
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++
    })

    return NextResponse.json({
      data: reviews,
      stats: {
        totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
        avgRoadQuality: Math.round(avgRoadQuality * 10) / 10,
        avgScenery: Math.round(avgScenery * 10) / 10,
        avgTwistiness: Math.round(avgTwistiness * 10) / 10,
        avgDifficulty: Math.round(avgDifficulty * 10) / 10,
        distribution,
      },
    })
  } catch (error) {
    console.error('Error fetching route reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch route reviews' }, { status: 500 })
  }
}

// POST /api/route-reviews — Create a review for a route
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, routeId, rating, roadQuality, scenery, twistiness, difficulty, comment } = body

    if (!userId || !routeId || rating === undefined) {
      return NextResponse.json(
        { error: 'userId, routeId, and rating are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate optional category ratings
    const validateCategory = (val: number | null | undefined, name: string): number | null => {
      if (val === null || val === undefined) return null
      if (val < 1 || val > 5) {
        throw new Error(`${name} must be between 1 and 5`)
      }
      return val
    }

    const validatedRoadQuality = validateCategory(roadQuality, 'roadQuality')
    const validatedScenery = validateCategory(scenery, 'scenery')
    const validatedTwistiness = validateCategory(twistiness, 'twistiness')
    const validatedDifficulty = validateCategory(difficulty, 'difficulty')

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify route exists
    const route = await db.route.findUnique({ where: { id: routeId } })
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    // Check if user already reviewed this route (upsert)
    const existing = await db.routeReview.findUnique({
      where: { userId_routeId: { userId, routeId } },
    })

    if (existing) {
      // Update existing review
      const updated = await db.routeReview.update({
        where: { id: existing.id },
        data: {
          rating,
          roadQuality: validatedRoadQuality,
          scenery: validatedScenery,
          twistiness: validatedTwistiness,
          difficulty: validatedDifficulty,
          comment: comment || null,
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      })
      return NextResponse.json({ data: updated })
    }

    // Create new review
    const review = await db.routeReview.create({
      data: {
        userId,
        routeId,
        rating,
        roadQuality: validatedRoadQuality,
        scenery: validatedScenery,
        twistiness: validatedTwistiness,
        difficulty: validatedDifficulty,
        comment: comment || null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ data: review }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be between 1 and 5')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error creating route review:', error)
    return NextResponse.json({ error: 'Failed to create route review' }, { status: 500 })
  }
}
