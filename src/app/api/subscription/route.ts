import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/subscription?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const subscription = await db.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!subscription) {
      // Return free plan default
      return NextResponse.json({
        data: {
          id: '',
          userId,
          plan: 'free',
          status: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    }

    // Check if trial expired
    if (subscription.status === 'trial' && subscription.trialEndsAt && new Date() > subscription.trialEndsAt) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      })
      subscription.status = 'expired'
    }

    return NextResponse.json({
      data: {
        id: subscription.id,
        userId: subscription.userId,
        plan: subscription.plan,
        status: subscription.status,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Subscription GET error:', error)
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 })
  }
}

// POST /api/subscription — Create or upgrade subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, plan } = body

    if (!userId || !plan) {
      return NextResponse.json({ error: 'userId and plan are required' }, { status: 400 })
    }

    if (!['pro', 'elite'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan. Must be pro or elite' }, { status: 400 })
    }

    // Check existing subscription
    const existing = await db.subscription.findFirst({
      where: { userId, status: { in: ['active', 'trial'] } },
    })

    if (existing) {
      // Upgrade existing
      const updated = await db.subscription.update({
        where: { id: existing.id },
        data: {
          plan,
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          stripeCustomerId: `cus_sim_${userId.slice(0, 8)}`,
          stripeSubscriptionId: `sub_sim_${Date.now()}`,
          stripePriceId: plan === 'pro' ? 'price_pro_monthly' : 'price_elite_monthly',
        },
      })

      return NextResponse.json({
        data: {
          id: updated.id,
          userId: updated.userId,
          plan: updated.plan,
          status: updated.status,
          trialEndsAt: updated.trialEndsAt?.toISOString() || null,
          currentPeriodEnd: updated.currentPeriodEnd?.toISOString() || null,
          cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      })
    }

    // Create new subscription with 14-day trial
    const subscription = await db.subscription.create({
      data: {
        userId,
        plan,
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        stripeCustomerId: `cus_sim_${userId.slice(0, 8)}`,
        stripeSubscriptionId: `sub_sim_${Date.now()}`,
        stripePriceId: plan === 'pro' ? 'price_pro_monthly' : 'price_elite_monthly',
      },
    })

    return NextResponse.json({
      data: {
        id: subscription.id,
        userId: subscription.userId,
        plan: subscription.plan,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Subscription POST error:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}

// PUT /api/subscription — Cancel, reactivate, or upgrade
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, action, plan } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
    }

    const existing = await db.subscription.findFirst({
      where: { userId, status: { in: ['active', 'trial'] } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'cancel':
        updateData = { cancelAtPeriodEnd: true }
        break
      case 'reactivate':
        updateData = { cancelAtPeriodEnd: false }
        break
      case 'upgrade':
        if (!plan || !['pro', 'elite'].includes(plan)) {
          return NextResponse.json({ error: 'Valid plan required for upgrade' }, { status: 400 })
        }
        updateData = {
          plan,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          stripePriceId: plan === 'pro' ? 'price_pro_monthly' : 'price_elite_monthly',
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await db.subscription.update({
      where: { id: existing.id },
      data: updateData,
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        userId: updated.userId,
        plan: updated.plan,
        status: updated.status,
        trialEndsAt: updated.trialEndsAt?.toISOString() || null,
        currentPeriodEnd: updated.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Subscription PUT error:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
