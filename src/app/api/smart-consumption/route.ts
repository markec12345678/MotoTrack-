import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── Base consumption by bike category (L/100km) ────────────────────────
const CATEGORY_BASE: Record<string, { name: string; min: number; max: number }> = {
  scooter: { name: 'Skuter', min: 2.5, max: 3.5 },
  naked: { name: 'Golo', min: 4.0, max: 5.5 },
  sport: { name: 'Športno', min: 5.5, max: 7.5 },
  touring: { name: 'Turistično', min: 5.0, max: 7.0 },
  adventure: { name: 'Pustolovsko', min: 4.5, max: 6.5 },
  cruiser: { name: 'Križar', min: 4.5, max: 6.0 },
}

// ─── Riding style multipliers ───────────────────────────────────────────
const STYLE_FACTORS: Record<string, { name: string; factor: number }> = {
  calm: { name: 'Miren', factor: 0.85 },
  normal: { name: 'Običajen', factor: 1.0 },
  sporty: { name: 'Športen', factor: 1.15 },
  aggressive: { name: 'Agresiven', factor: 1.30 },
}

// ─── Engine displacement factors ────────────────────────────────────────
function getDisplacementFactor(cc: number): { factor: number; label: string } {
  if (cc <= 250) return { factor: 0.70, label: '<250cc' }
  if (cc <= 500) return { factor: 0.85, label: '250-500cc' }
  if (cc <= 800) return { factor: 1.00, label: '500-800cc' }
  if (cc <= 1200) return { factor: 1.15, label: '800-1200cc' }
  return { factor: 1.30, label: '>1200cc' }
}

// ─── Speed factor ───────────────────────────────────────────────────────
function getSpeedFactor(kmh: number): { factor: number; label: string } {
  if (kmh < 60) return { factor: 0.90, label: '<60 km/h' }
  if (kmh <= 90) return { factor: 1.00, label: '60-90 km/h' }
  if (kmh <= 120) return { factor: 1.10, label: '90-120 km/h' }
  if (kmh <= 150) return { factor: 1.25, label: '120-150 km/h' }
  return { factor: 1.45, label: '>150 km/h' }
}

// ─── Elevation factor ───────────────────────────────────────────────────
function getElevationFactor(meters: number): { factor: number; label: string } {
  if (meters <= 0) return { factor: 1.0, label: 'Brez vzpona' }
  const factor = 1 + (meters / 1000) * 0.05
  return { factor: Math.min(factor, 1.5), label: `${Math.round(meters)}m vzpona` }
}

// ─── Generate tips in Slovenian ─────────────────────────────────────────
function generateTips(
  bikeCategory: string,
  ridingStyle: string,
  avgSpeed: number | null,
  engineDisplacement: number
): string[] {
  const tips: string[] = []

  if (ridingStyle === 'aggressive') {
    tips.push('Agresiven vozni slog povečuje porabo za 15-30%. Zmanjšajte hitrost in pospešujte postopoma.')
  } else if (ridingStyle === 'sporty') {
    tips.push('Športen vozni slog povečuje porabo za približno 15%. Enakomerna vožnja prihrani gorivo.')
  }

  if (avgSpeed && avgSpeed > 120) {
    tips.push('Pri hitrostih nad 120 km/h se poraba znatno poveča zaradi zračnega upora. Vsakih 10 km/h več pomeni 5-10% več porabe.')
  }

  if (engineDisplacement > 1000) {
    tips.push('Veliki motorji (>1000cc) porabijo več goriva. Priporočamo redno vzdrževanje in optimalen tlak pnevmatik.')
  }

  if (bikeCategory === 'sport') {
    tips.push('Športni motocikli so zasnovani za visoke obrate, kar povečuje porabo. Vožnja pri nižjih obratih prihrani gorivo.')
  } else if (bikeCategory === 'adventure') {
    tips.push('Adventure motocikli so težji in manj aerodinamični. Na avtocesti pritrdite prtljago čim bolj aerodinamično.')
  } else if (bikeCategory === 'scooter') {
    tips.push('Skuterji so najbolj varčni, a jih je treba voziti enakomerno. Izogibajte se pretiranemu pospeševanju.')
  }

  tips.push('Pravilni tlak pnevmatik lahko prihrani do 3% goriva.')
  tips.push('Redno vzdrževanje (zračni filter, svečke, veriga) ohranja optimalno porabo.')

  return tips
}

// ─── GET handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bikeCategory = searchParams.get('bikeCategory') || 'naked'
    const ridingStyle = searchParams.get('ridingStyle') || 'normal'
    const engineDisplacement = parseInt(searchParams.get('engineDisplacement') || '600')
    const avgSpeed = searchParams.get('avgSpeed') ? parseFloat(searchParams.get('avgSpeed')!) : null
    const elevation = searchParams.get('elevation') ? parseFloat(searchParams.get('elevation')!) : null
    const distance = searchParams.get('distance') ? parseFloat(searchParams.get('distance')!) : null
    const userId = searchParams.get('userId')

    // ── Get user's fuel data if userId provided ──
    let fuelCapacity = 15.0
    let currentFuel = 15.0
    let userBikeCategory = bikeCategory
    let userRidingStyle = ridingStyle
    let userDisplacement = engineDisplacement

    if (userId) {
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: {
            fuelCapacity: true,
            currentFuel: true,
            bikeCategory: true,
            ridingStyle: true,
            bike: true,
          },
        })
        if (user) {
          fuelCapacity = user.fuelCapacity ?? 15.0
          currentFuel = user.currentFuel ?? 15.0
          if (user.bikeCategory) userBikeCategory = user.bikeCategory
          if (user.ridingStyle) userRidingStyle = user.ridingStyle
          // Try to parse displacement from bike name (e.g., "BMW R1250GS" -> 1250)
          if (user.bike) {
            const ccMatch = user.bike.match(/(\d{2,4})\s*cc/i) || user.bike.match(/(\d{3,4})/)
            if (ccMatch) userDisplacement = parseInt(ccMatch[1])
          }
        }
      } catch {
        // DB not available, use defaults
      }
    }

    const category = CATEGORY_BASE[userBikeCategory] || CATEGORY_BASE.naked
    const style = STYLE_FACTORS[userRidingStyle] || STYLE_FACTORS.normal
    const displacement = getDisplacementFactor(userDisplacement)
    const speed = avgSpeed ? getSpeedFactor(avgSpeed) : null
    const elev = elevation ? getElevationFactor(elevation) : null

    // ── Calculate base consumption (middle of range) ──
    const baseConsumption = (category.min + category.max) / 2

    // ── Calculate adjusted consumption ──
    let adjustedConsumption = baseConsumption
    adjustedConsumption *= style.factor
    adjustedConsumption *= displacement.factor
    if (speed) adjustedConsumption *= speed.factor
    if (elev) adjustedConsumption *= elev.factor

    // Round to 1 decimal
    adjustedConsumption = Math.round(adjustedConsumption * 10) / 10

    // ── Calculate estimated range ──
    const estimatedRange = adjustedConsumption > 0
      ? Math.round((currentFuel / adjustedConsumption) * 100)
      : 0

    // ── Calculate estimated fuel cost for given distance ──
    let estimatedCost: number | null = null
    if (distance && distance > 0) {
      const litersNeeded = (distance / 100) * adjustedConsumption
      // Use average Slovenian fuel price (~1.55 EUR/L)
      estimatedCost = Math.round(litersNeeded * 1.55 * 100) / 100
    }

    // ── Comparison across all riding styles ──
    const comparison: Record<string, number> = {}
    for (const [key, val] of Object.entries(STYLE_FACTORS)) {
      let consumption = baseConsumption * val.factor * displacement.factor
      if (speed) consumption *= speed.factor
      if (elev) consumption *= elev.factor
      comparison[key] = Math.round(consumption * 10) / 10
    }

    // ── Generate tips ──
    const tips = generateTips(userBikeCategory, userRidingStyle, avgSpeed, userDisplacement)

    // ── Build factors detail ──
    const factors: Record<string, { name: string; value: string; factor: number }> = {
      bikeCategory: { name: category.name, value: `${baseConsumption.toFixed(1)} L/100km`, factor: 1.0 },
      ridingStyle: { name: style.name, value: `×${style.factor}`, factor: style.factor },
      engineDisplacement: { name: displacement.label, value: `${userDisplacement}cc`, factor: displacement.factor },
    }
    if (speed) factors.speed = { name: speed.label, value: `${avgSpeed} km/h`, factor: speed.factor }
    if (elev) factors.elevation = { name: elev.label, value: `${elevation}m`, factor: elev.factor }

    return NextResponse.json({
      data: {
        baseConsumption,
        adjustedConsumption,
        factors,
        estimatedRange,
        fuelCapacity,
        currentFuel,
        estimatedCost,
        tips,
        comparison,
        bikeCategory: userBikeCategory,
        ridingStyle: userRidingStyle,
        engineDisplacement: userDisplacement,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
