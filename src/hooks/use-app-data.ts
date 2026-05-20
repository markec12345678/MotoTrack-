'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { RideData, RouteData, UserData, LeaderboardUser } from '@/components/tabs/types'

/**
 * useAppData — Extracted from home.tsx
 * 
 * Manages core app data: user, rides, routes, leaderboard,
 * data fetching, and user switching.
 */

export function useAppData() {
  const [rides, setRides] = useState<RideData[]>([])
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const seedChecked = useRef(false)

  // Fetch data - use single /api/init endpoint
  const fetchData = useCallback(async () => {
    try {
      const initRes = await fetch('/api/init')
      if (initRes.ok) {
        const j = await initRes.json()
        const d = j.data || j
        setRides(d.rides || [])
        setRoutes(d.routes || [])
        setUser(d.defaultUser || null)
        setAllUsers(d.users || [])
        setLeaderboard(d.leaderboard || [])
        
        if (d.needsSeed && !seedChecked.current) {
          seedChecked.current = true
          try {
            await fetch('/api/seed', { method: 'POST' })
            const retryRes = await fetch('/api/init')
            if (retryRes.ok) {
              const rj = await retryRes.json()
              const rd = rj.data || rj
              setRides(rd.rides || [])
              setRoutes(rd.routes || [])
              setUser(rd.defaultUser || null)
              setAllUsers(rd.users || [])
              setLeaderboard(rd.leaderboard || [])
            }
          } catch { /* ignore seed errors */ }
        }
      }
    } catch (err) { console.error('Fetch error:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Switch user
  const switchUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`)
      if (res.ok) {
        const j = await res.json()
        const userData = j.data || j
        setUser(userData)
        toast.success(`Preklopljen na ${userData.name || 'uporabnika'}`)
      }
    } catch { toast.error('Napaka pri preklopu') }
  }, [])

  // Toggle like on a route
  const toggleLike = useCallback(async (routeId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/routes/${routeId}/like`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ userId: user.id }) 
      })
      if (res.ok) {
        const j = await res.json()
        setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, likes: j.data.likes, userLiked: j.data.userLiked } : r))
        return j.data
      }
    } catch { toast.error('Napaka') }
    return null
  }, [user])

  return {
    rides, routes, user, allUsers, leaderboard, loading,
    fetchData, switchUser, toggleLike,
    setRides, setRoutes, setUser,
  }
}
