'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { haversine } from '@/components/tabs/types'

/**
 * usePlanRoute — Extracted from home.tsx
 * 
 * Manages route planning state: waypoints, title, category,
 * routing mode, distance calculation, route saving, and sharing.
 */

interface UsePlanRouteOptions {
  userId?: string
  onRouteSaved?: () => void
  activeTab?: string
}

export function usePlanRoute(options: UsePlanRouteOptions = {}) {
  const { userId, onRouteSaved, activeTab } = options

  const [planWaypoints, setPlanWaypoints] = useState<{ lat: number; lng: number }[]>([])
  const [planAvoidHighways, setPlanAvoidHighways] = useState(false)
  const [planAvoidTolls, setPlanAvoidTolls] = useState(false)
  const [planRoutingMode, setPlanRoutingMode] = useState<'paved' | 'twisty' | 'offroad'>('paved')
  const [planTitle, setPlanTitle] = useState('')
  const [planCategory, setPlanCategory] = useState('scenic')
  const [planDistance, setPlanDistance] = useState(0)

  // Plan share dialog
  const [showPlanShare, setShowPlanShare] = useState(false)
  const [planShareRouteId, setPlanShareRouteId] = useState<string | null>(null)
  const [planShareTitle, setPlanShareTitle] = useState('')

  // Calculate plan distance
  useEffect(() => {
    let dist = 0
    for (let i = 1; i < planWaypoints.length; i++) {
      dist += haversine(planWaypoints[i - 1].lat, planWaypoints[i - 1].lng, planWaypoints[i].lat, planWaypoints[i].lng)
    }
    setPlanDistance(Math.round(dist * 10) / 10)
  }, [planWaypoints])

  // Save route
  const saveRoute = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const res = await fetch('/api/routes', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          title: planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`, 
          description: '', distance: planDistance, 
          waypoints: JSON.stringify(planWaypoints), routeData, 
          category: planCategory, difficulty: 'medium', isPublic: true 
        }) 
      })
      if (res.ok) {
        const j = await res.json()
        toast.success('Pot shranjena!')
        setPlanWaypoints([]); setPlanTitle(''); setPlanDistance(0)
        onRouteSaved?.()
        if (userId) {
          fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
            .then(r => r.json())
            .then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) })
            .catch(() => {})
        }
        return j.data?.id || null
      }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
    return null
  }, [planWaypoints, planTitle, planDistance, planCategory, onRouteSaved, userId])

  // Send to Phone: save route and open QR share dialog
  const sendToPhone = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const title = planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`
      const res = await fetch('/api/routes', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          title, description: '', distance: planDistance, 
          waypoints: JSON.stringify(planWaypoints), routeData, 
          category: planCategory, difficulty: 'medium', isPublic: true 
        }) 
      })
      if (res.ok) {
        const j = await res.json()
        const routeId = j.data?.id
        if (routeId) {
          setPlanShareRouteId(routeId)
          setPlanShareTitle(title)
          setShowPlanShare(true)
        }
        onRouteSaved?.()
        if (userId) {
          fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
            .then(r => r.json())
            .then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) })
            .catch(() => {})
        }
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri pošiljanju na telefon')
    }
  }, [planWaypoints, planTitle, planDistance, planCategory, onRouteSaved, userId])

  // Handle map click (add waypoint when on plan tab)
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeTab === 'plan') {
      setPlanWaypoints(prev => {
        const maxWP = planRoutingMode === 'offroad' ? 100 : 25
        if (prev.length >= maxWP) {
          toast.error(`Največ ${maxWP} točk za ${planRoutingMode === 'offroad' ? 'terensko' : 'ta način'} načrtovanje`)
          return prev
        }
        return [...prev, { lat, lng }]
      })
    }
  }, [activeTab, planRoutingMode])

  // Load tour waypoints into plan
  const loadTourToPlan = useCallback((waypoints: { lat: number; lng: number }[], name: string) => {
    setPlanWaypoints(waypoints)
    setPlanTitle(name)
    setPlanCategory('scenic')
  }, [])

  // Handle shared route from URL
  const loadSharedRoute = useCallback(async (routeCode: string) => {
    try {
      const res = await fetch(`/api/routes/share?code=${encodeURIComponent(routeCode)}`)
      const j = await res.json()
      if (j.data?.waypoints) {
        try {
          const waypoints = typeof j.data.waypoints === 'string'
            ? JSON.parse(j.data.waypoints)
            : j.data.waypoints
          if (Array.isArray(waypoints) && waypoints.length >= 2) {
            setPlanWaypoints(waypoints.map((w: any) => ({ lat: w.lat, lng: w.lng })))
            setPlanTitle(j.data.title || `Deljena ruta: ${routeCode}`)
            setPlanCategory(j.data.category || 'scenic')
            toast.success(`🗺️ Ruta "${j.data.title || routeCode}" naložena!`)
            window.history.replaceState({}, '', '/')
            return true
          }
        } catch { /* ignore parse errors */ }
      }
    } catch {
      toast.error('Napaka pri nalaganju deljene rute')
    }
    return false
  }, [])

  return {
    // State
    planWaypoints, setPlanWaypoints,
    planTitle, setPlanTitle,
    planCategory, setPlanCategory,
    planAvoidHighways, setPlanAvoidHighways,
    planAvoidTolls, setPlanAvoidTolls,
    planRoutingMode, setPlanRoutingMode,
    planDistance,
    showPlanShare, setShowPlanShare,
    planShareRouteId, setPlanShareRouteId,
    planShareTitle,
    // Actions
    saveRoute, sendToPhone, handleMapClick, loadTourToPlan, loadSharedRoute,
  }
}
