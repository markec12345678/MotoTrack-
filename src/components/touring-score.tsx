'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Trophy, Target, TrendingUp, Shield, Users, Route, Zap, ChevronRight, Star, Award, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────
interface TouringScoreProps {
  rides: Array<{
    id: string
    distance: number
    duration: number
    maxSpeed: number
    avgSpeed: number
    createdAt: string
    isPublic: boolean
  }>
  routes: Array<{
    id: string
    likes: number
    category: string
    difficulty: string
  }>
  userId?: string
}

interface CategoryScore {
  key: string
  label: string
  icon: React.ReactNode
  score: number // 0-100
  weight: number
  tip: string
}

interface RankInfo {
  label: string
  emoji: string
  color: string
  minScore: number
}

const RANKS: RankInfo[] = [
  { label: 'Legenda', emoji: '👑', color: '#ef4444', minScore: 800 },
  { label: 'Pustolovec', emoji: '⚔️', color: '#f97316', minScore: 600 },
  { label: 'Popotnik', emoji: '🗺️', color: '#eab308', minScore: 400 },
  { label: 'Motorist', emoji: '🏍️', color: '#3b82f6', minScore: 200 },
  { label: 'Novinec', emoji: '🌱', color: '#22c55e', minScore: 0 },
]

function getRank(totalScore: number): RankInfo {
  return RANKS.find(r => totalScore >= r.minScore) || RANKS[RANKS.length - 1]
}

function getNextRank(totalScore: number): RankInfo | null {
  const idx = RANKS.findIndex(r => totalScore >= r.minScore)
  if (idx <= 0) return null
  return RANKS[idx - 1]
}

// ─── Animated number hook ────────────────────────────────────────────
function useAnimatedValue(target: number, duration = 1200): number {
  const [current, setCurrent] = useState(0)
  const prevTarget = useRef(0)
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)

  useEffect(() => {
    const start = prevTarget.current
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(start + diff * eased))
      if (progress < 1) {
        animRef.current = requestAnimationFrame(step)
      } else {
        prevTarget.current = target
      }
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [target, duration])

  return current
}

// ─── SVG Circular Gauge ──────────────────────────────────────────────
function ScoreGauge({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const radius = size / 2 - 10
  const stroke = 8
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (score / 1000) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={normalizedRadius}
        fill="none" stroke="currentColor" strokeWidth={stroke}
        className="text-muted-foreground/15"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={normalizedRadius}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.4s ease' }}
      />
      {/* Glow */}
      <circle
        cx={size / 2} cy={size / 2} r={normalizedRadius}
        fill="none" stroke={color} strokeWidth={stroke + 4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out', opacity: 0.15, filter: 'blur(4px)' }}
      />
    </svg>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
export default function TouringScore({ rides, routes, userId }: TouringScoreProps) {
  const [showInfo, setShowInfo] = useState(false)

  // Calculate category scores
  const categories = useMemo((): CategoryScore[] => {
    const totalKm = rides.reduce((s, r) => s + r.distance, 0)
    const totalRoutes = routes.length
    const publicRides = rides.filter(r => r.isPublic).length
    const totalLikes = routes.reduce((s, r) => s + (r.likes || 0), 0)

    // 1. Distance (20%) - based on total km
    const distScore = Math.min(100, Math.round(totalKm / 10)) // 1000km = 100
    const distTip = totalKm < 100
      ? 'Prevozite še več kilometrov za višjo oceno!'
      : totalKm < 500
        ? 'Dobro ste začeli! Ciljajte na 1000 km.'
        : 'Odlična razdalja! Steže vam ni konec!'

    // 2. Consistency (20%) - ride regularly (days with rides in last 30 days)
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400000
    const recentRides = rides.filter(r => new Date(r.createdAt).getTime() > thirtyDaysAgo)
    const uniqueDays = new Set(recentRides.map(r => new Date(r.createdAt).toDateString())).size
    const consistencyScore = Math.min(100, Math.round(uniqueDays * 5)) // 20 days = 100
    const consistencyTip = uniqueDays < 4
      ? 'Poskusite voziti bolj redno - tudi kratke vožnje štejejo!'
      : 'Super doslednost! Nadaljujte v istem ritmu.'

    // 3. Variety (15%) - different categories explored
    const categoriesExplored = new Set(routes.map(r => r.category)).size
    const varietyScore = Math.min(100, Math.round(categoriesExplored * 25)) // 4 = 100
    const varietyTip = categoriesExplored < 3
      ? 'Raziskujte različne tipe poti: slikovite, vijugaste, terenske!'
      : 'Raznolikost je ključ do visoke ocene!'

    // 4. Challenge (15%) - difficult rides, extreme conditions
    const hardRoutes = routes.filter(r => r.difficulty === 'hard' || r.difficulty === 'expert').length
    const highSpeedRides = rides.filter(r => r.maxSpeed > 120).length
    const challengeScore = Math.min(100, Math.round((hardRoutes * 15 + highSpeedRides * 10)))
    const challengeTip = hardRoutes === 0
      ? 'Preizkusite zahtevnejše poti za več izzivov!'
      : 'Ste pogumni pustolovec! Izzivi so vaša moč.'

    // 5. Community (15%) - likes, comments, shared rides
    const communityScore = Math.min(100, Math.round(publicRides * 10 + totalLikes * 3))
    const communityTip = publicRides === 0
      ? 'Delite svoje vožnje javno in pridobite všečke!'
      : 'Skupnost vas opazi! Nadaljujte z deljenjem.'

    // 6. Safety (15%) - smooth riding, no excessive speeds
    const avgMaxSpeed = rides.length > 0 ? rides.reduce((s, r) => s + r.maxSpeed, 0) / rides.length : 0
    const safetyScore = avgMaxSpeed > 160 ? 20 : avgMaxSpeed > 130 ? 50 : avgMaxSpeed > 100 ? 75 : 90
    const safetyTip = avgMaxSpeed > 130
      ? 'Zmanjšajte povprečno maksimalno hitrost za varnejšo vožnjo.'
      : 'Varnost na prvem mestu! Odlična vožnja.'

    return [
      { key: 'distance', label: 'Razdalja', icon: <Route className="size-3.5" />, score: distScore, weight: 20, tip: distTip },
      { key: 'consistency', label: 'Doslednost', icon: <Target className="size-3.5" />, score: consistencyScore, weight: 20, tip: consistencyTip },
      { key: 'variety', label: 'Raznolikost', icon: <Star className="size-3.5" />, score: varietyScore, weight: 15, tip: varietyTip },
      { key: 'challenge', label: 'Izziv', icon: <Zap className="size-3.5" />, score: challengeScore, weight: 15, tip: challengeTip },
      { key: 'community', label: 'Skupnost', icon: <Users className="size-3.5" />, score: communityScore, weight: 15, tip: communityTip },
      { key: 'safety', label: 'Varnost', icon: <Shield className="size-3.5" />, score: safetyScore, weight: 15, tip: safetyTip },
    ]
  }, [rides, routes])

  // Calculate total score (0-1000)
  const totalScore = useMemo(() => {
    const weightedSum = categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
    return Math.round(weightedSum / 10) // max = 100*100/10 = 1000
  }, [categories])

  const rank = getRank(totalScore)
  const nextRank = getNextRank(totalScore)
  const scoreToNext = nextRank ? nextRank.minScore - totalScore : 0

  // Animated values
  const animatedScore = useAnimatedValue(totalScore)

  // Weekly trend (simulated - would be from API in production)
  const weeklyTrend = useMemo(() => {
    // Simple: compare recent rides count vs older
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const twoWeeksAgo = now - 14 * 86400000
    const thisWeek = rides.filter(r => new Date(r.createdAt).getTime() > weekAgo).length
    const lastWeek = rides.filter(r => {
      const t = new Date(r.createdAt).getTime()
      return t > twoWeeksAgo && t <= weekAgo
    }).length
    return thisWeek - lastWeek
  }, [rides])

  if (rides.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 text-center">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Trophy className="size-8 text-primary/40" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Touring Score</h3>
          <p className="text-xs text-muted-foreground">Začnite z vožnjami za oceno!</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Vaša skupna ocena motorista bo izračunana iz 6 kategorij</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Trophy className="size-3.5 text-primary" />
            </div>
            <div>
              <h4 className="text-xs font-semibold">Touring Score</h4>
              <p className="text-[9px] text-muted-foreground">Skupna ocena motorista</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded-md hover:bg-secondary/50 transition-colors"
            title="Kako se izračuna?"
          >
            <Info className="size-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Info tooltip */}
        {showInfo && (
          <div className="bg-secondary/50 rounded-md p-2.5 text-[10px] text-muted-foreground space-y-1 border border-border/30">
            <p><strong className="text-foreground">Kako deluje?</strong></p>
            <p>Touring Score je ocena 0-1000, izračunana iz 6 kategorij:</p>
            <p>Razdalja (20%), Doslednost (20%), Raznolikost (15%), Izziv (15%), Skupnost (15%), Varnost (15%)</p>
            <p>Vsaka kategorija je ocenjena 0-100, nato obtežena in pretvorjena v skupno oceno.</p>
          </div>
        )}

        {/* Main Score Display */}
        <div className="flex items-center gap-5">
          {/* Gauge */}
          <div className="relative flex-shrink-0">
            <ScoreGauge score={totalScore} color={rank.color} size={110} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-2xl font-black tabular-nums leading-none"
                style={{ color: rank.color, transition: 'color 0.4s ease' }}
              >
                {animatedScore}
              </span>
              <span className="text-[7px] text-muted-foreground uppercase tracking-wider mt-0.5">
                /1000
              </span>
            </div>
          </div>

          {/* Rank + Trend */}
          <div className="flex-1 space-y-2.5">
            {/* Rank badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={{
                backgroundColor: rank.color + '15',
                color: rank.color,
                borderColor: rank.color + '30',
              }}
            >
              <span className="text-sm">{rank.emoji}</span>
              <span>{rank.label}</span>
            </div>

            {/* Weekly trend */}
            <div className="flex items-center gap-1.5">
              {weeklyTrend > 0 ? (
                <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
                  <TrendingUp className="size-3" /> +{weeklyTrend} ta teden
                </span>
              ) : weeklyTrend < 0 ? (
                <span className="text-[10px] font-semibold text-red-400 flex items-center gap-0.5">
                  <TrendingUp className="size-3 rotate-180" /> {weeklyTrend} ta teden
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <TrendingUp className="size-3" /> Enako kot prejšnji teden
                </span>
              )}
            </div>

            {/* Next rank progress */}
            {nextRank && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground">Do <strong>{nextRank.emoji} {nextRank.label}</strong></span>
                  <span className="font-semibold" style={{ color: nextRank.color }}>še {scoreToNext}</span>
                </div>
                <Progress value={((totalScore - rank.minScore) / (nextRank.minScore - rank.minScore)) * 100} className="h-1.5" />
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-2.5">
          <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Razčlenitev ocene</h5>
          {categories.map(cat => (
            <div key={cat.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{cat.icon}</span>
                  <span className="text-[11px] font-medium">{cat.label}</span>
                  <span className="text-[9px] text-muted-foreground">({cat.weight}%)</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums">{cat.score}</span>
              </div>
              <Progress value={cat.score} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Award className="size-3" /> Nasveti za izboljšanje
          </h5>
          {categories
            .filter(c => c.score < 60)
            .slice(0, 3)
            .map(cat => (
              <div key={cat.key} className="flex items-start gap-2 rounded-md p-2 bg-secondary/30">
                <ChevronRight className="size-3 mt-0.5 text-primary flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-medium">{cat.label}: </span>
                  <span className="text-[10px] text-muted-foreground">{cat.tip}</span>
                </div>
              </div>
            ))}
          {categories.every(c => c.score >= 60) && (
            <div className="flex items-start gap-2 rounded-md p-2 bg-emerald-500/10 border border-emerald-500/20">
              <Award className="size-3 mt-0.5 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Odlično! Vse kategorije so na visokem nivoju!</span>
            </div>
          )}
        </div>

        {/* Rank Scale */}
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground/60">
          <span>🌱 Novinec</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-green-500" />
            <div className="flex-1 bg-blue-500" />
            <div className="flex-1 bg-yellow-500" />
            <div className="flex-1 bg-orange-500" />
            <div className="flex-1 bg-red-500" />
          </div>
          <span>👑 Legenda</span>
        </div>
      </CardContent>
    </Card>
  )
}
