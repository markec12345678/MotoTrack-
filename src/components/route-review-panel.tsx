'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Star, MessageSquare, Waypoints, TreePine, Spline, ShieldAlert, Send, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface RouteReviewPanelProps {
  routeId: string
  userId?: string | null
}

interface ReviewUser {
  id: string
  name: string
  avatar: string | null
}

interface ReviewData {
  id: string
  userId: string
  routeId: string
  rating: number
  roadQuality: number | null
  scenery: number | null
  twistiness: number | null
  difficulty: number | null
  comment: string | null
  createdAt: string
  updatedAt: string
  user: ReviewUser
}

interface ReviewStats {
  totalReviews: number
  avgRating: number
  avgRoadQuality: number
  avgScenery: number
  avgTwistiness: number
  avgDifficulty: number
  distribution: number[]
}

// ─── Star Rating Component ────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  size = 'sm',
  readonly = false,
}: {
  value: number
  onChange?: (val: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}) {
  const sizeClass = size === 'lg' ? 'size-7' : size === 'md' ? 'size-5' : 'size-4'
  const [hoverVal, setHoverVal] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform disabled:opacity-100`}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverVal(star)}
          onMouseLeave={() => !readonly && setHoverVal(0)}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              star <= (hoverVal || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-muted-foreground/40'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Category Rating Row ──────────────────────────────────────────────────────

function CategoryRating({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  value: number
  onChange: (val: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <StarRating value={value} onChange={onChange} size="sm" />
    </div>
  )
}

// ─── Difficulty Label ──────────────────────────────────────────────────────────

function difficultyLabel(val: number): string {
  switch (val) {
    case 1: return 'Lahka'
    case 2: return 'Zmerna'
    case 3: return 'Srednja'
    case 4: return 'Zahtevna'
    case 5: return 'Ekstremna'
    default: return ''
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RouteReviewPanel({ routeId, userId }: RouteReviewPanelProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [rating, setRating] = useState(0)
  const [roadQuality, setRoadQuality] = useState(0)
  const [scenery, setScenery] = useState(0)
  const [twistiness, setTwistiness] = useState(0)
  const [difficulty, setDifficulty] = useState(0)
  const [comment, setComment] = useState('')

  // Existing user review
  const [existingReview, setExistingReview] = useState<ReviewData | null>(null)

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/route-reviews?routeId=${routeId}`)
      if (res.ok) {
        const json = await res.json()
        setReviews(json.data || [])
        setStats(json.stats || null)

        // Check if current user already has a review
        if (userId) {
          const existing = (json.data || []).find(
            (r: ReviewData) => r.userId === userId
          )
          if (existing) {
            setExistingReview(existing)
            setRating(existing.rating)
            setRoadQuality(existing.roadQuality ?? 0)
            setScenery(existing.scenery ?? 0)
            setTwistiness(existing.twistiness ?? 0)
            setDifficulty(existing.difficulty ?? 0)
            setComment(existing.comment ?? '')
          }
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [routeId, userId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleSubmit = async () => {
    if (!userId) {
      toast.error('Prijava je obvezna')
      return
    }
    if (rating === 0) {
      toast.error('Izberite splošno oceno')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/route-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          routeId,
          rating,
          roadQuality: roadQuality > 0 ? roadQuality : null,
          scenery: scenery > 0 ? scenery : null,
          twistiness: twistiness > 0 ? twistiness : null,
          difficulty: difficulty > 0 ? difficulty : null,
          comment: comment.trim() || null,
        }),
      })

      if (res.ok) {
        toast.success(existingReview ? 'Ocena posodobljena!' : 'Ocena oddana!')
        setExistingReview(null)
        setRating(0)
        setRoadQuality(0)
        setScenery(0)
        setTwistiness(0)
        setDifficulty(0)
        setComment('')
        fetchReviews()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Napaka pri oddaji ocene')
      }
    } catch {
      toast.error('Napaka pri oddaji ocene')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('sl-SI', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Average Rating Display ──────────────────────────────────────── */}
      {stats && stats.totalReviews > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Big average */}
              <div className="text-center shrink-0">
                <p className="text-3xl font-bold">{stats.avgRating.toFixed(1)}</p>
                <StarRating value={Math.round(stats.avgRating)} readonly size="sm" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.totalReviews} {stats.totalReviews === 1 ? 'ocena' : stats.totalReviews === 2 ? 'oceni' : 'ocen'}
                </p>
              </div>

              {/* Distribution bars */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = stats.distribution[star - 1]
                  const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-3 text-right">{star}</span>
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Category averages */}
            <Separator className="my-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kakovost ceste</p>
                <p className="text-sm font-medium">{stats.avgRoadQuality > 0 ? stats.avgRoadQuality.toFixed(1) : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pokrajina</p>
                <p className="text-sm font-medium">{stats.avgScenery > 0 ? stats.avgScenery.toFixed(1) : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vijugavost</p>
                <p className="text-sm font-medium">{stats.avgTwistiness > 0 ? stats.avgTwistiness.toFixed(1) : '—'}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Zahtevnost</p>
                <p className="text-sm font-medium">{stats.avgDifficulty > 0 ? stats.avgDifficulty.toFixed(1) : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Review Form ──────────────────────────────────────────────────── */}
      {userId && (
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Star className="size-4 text-amber-400" />
              {existingReview ? 'Posodobi oceno' : 'Oceni ruto'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Overall rating */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Splošna ocena *</p>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>

            {/* Category ratings */}
            <div className="space-y-2">
              <CategoryRating
                icon={<Waypoints className="size-3.5 text-muted-foreground" />}
                label="Kakovost ceste"
                value={roadQuality}
                onChange={setRoadQuality}
              />
              <CategoryRating
                icon={<TreePine className="size-3.5 text-muted-foreground" />}
                label="Pokrajina"
                value={scenery}
                onChange={setScenery}
              />
              <CategoryRating
                icon={<Spline className="size-3.5 text-muted-foreground" />}
                label="Vijugavost"
                value={twistiness}
                onChange={setTwistiness}
              />
              <CategoryRating
                icon={<ShieldAlert className="size-3.5 text-muted-foreground" />}
                label="Zahtevnost"
                value={difficulty}
                onChange={setDifficulty}
              />
              {difficulty > 0 && (
                <p className="text-[10px] text-muted-foreground ml-[7.5rem]">
                  {difficultyLabel(difficulty)}
                </p>
              )}
            </div>

            {/* Comment */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Komentar</p>
              <Textarea
                placeholder="Delite svojo izkušnjo s to ruto..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-sm min-h-[60px] resize-none"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                {comment.length}/500
              </p>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full gap-1.5"
              size="sm"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {existingReview ? 'Posodobi oceno' : 'Oddaj oceno'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Reviews List ─────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <MessageSquare className="size-3.5" /> Ocene
          {stats && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
              {stats.totalReviews}
            </Badge>
          )}
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <Star className="size-8 mb-2 opacity-40" />
            <p className="text-xs">Ni še ocen. Bodite prvi!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {reviews.map(review => (
              <Card key={review.id} className="border-border/30">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar className="size-7 shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {review.user?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{review.user?.name || 'Neznan'}</span>
                          <StarRating value={review.rating} readonly size="sm" />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>

                      {/* Category badges */}
                      {(review.roadQuality || review.scenery || review.twistiness || review.difficulty) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {review.roadQuality && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                              <Waypoints className="size-2.5" /> {review.roadQuality}/5
                            </Badge>
                          )}
                          {review.scenery && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                              <TreePine className="size-2.5" /> {review.scenery}/5
                            </Badge>
                          )}
                          {review.twistiness && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                              <Spline className="size-2.5" /> {review.twistiness}/5
                            </Badge>
                          )}
                          {review.difficulty && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 py-0">
                              <ShieldAlert className="size-2.5" /> {difficultyLabel(review.difficulty)}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Comment */}
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-1.5 break-words">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
