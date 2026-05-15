'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Brain,
  BarChart3,
  Video,
  Radio,
  RefreshCw,
} from 'lucide-react'
import type { RideData, RouteData } from '@/components/tabs/types'

// Lazy load feature panels - these are heavy and only needed when feature hub is open
const SmartRecommendationsPanel = dynamic(() => import('@/components/smart-recommendations-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const VideoSyncPanel = dynamic(() => import('@/components/video-sync-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const OfflineSyncPanel = dynamic(() => import('@/components/offline-sync-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const RouteRoiPanel = dynamic(() => import('@/components/route-roi-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const LiveTrackingPanel = dynamic(() => import('@/components/live-tracking-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const LiveTrackingViewer = dynamic(() => import('@/components/live-tracking-viewer'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })

type FeatureTab = 'roi' | 'smart' | 'video' | 'live' | 'sync'

interface FeatureHubDialogProps {
  open: boolean
  onClose: () => void
  user?: { id: string; name: string } | null
  selectedItem: RideData | RouteData | null
  selectedType: 'ride' | 'route'
  routes: RouteData[]
  userLat?: number
  userLng?: number
  onOpenDetail: (item: RouteData) => void
}

export default function FeatureHubDialog({
  open,
  onClose,
  user,
  selectedItem,
  selectedType,
  routes,
  userLat,
  userLng,
  onOpenDetail,
}: FeatureHubDialogProps) {
  const [featureTab, setFeatureTab] = useState<FeatureTab>('smart')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] bg-background border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-xl bg-primary/20">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Napredne funkcije</h2>
              <p className="text-[10px] text-muted-foreground">Vse zmožnosti MotoTrack — brezplačno</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Feature Tabs */}
        <div className="flex border-b border-border/30 overflow-x-auto">
          {[
            { id: 'smart' as const, label: 'Priporočila', icon: Brain },
            { id: 'roi' as const, label: 'ROI', icon: BarChart3 },
            { id: 'video' as const, label: 'Video', icon: Video },
            { id: 'live' as const, label: 'V živo', icon: Radio },
            { id: 'sync' as const, label: 'Sync', icon: RefreshCw },
          ].map(ft => (
            <button
              key={ft.id}
              onClick={() => setFeatureTab(ft.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                featureTab === ft.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ft.icon className="size-3.5" />
              {ft.label}
            </button>
          ))}
        </div>

        {/* Feature Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {featureTab === 'smart' && (
            <SmartRecommendationsPanel
              userId={user?.id}
              userLat={userLat}
              userLng={userLng}
              onOpenDetail={(route) => {
                onClose()
                onOpenDetail(route)
              }}
            />
          )}
          {featureTab === 'roi' && selectedType === 'route' && selectedItem && (
            <RouteRoiPanel
              routeId={selectedItem.id}
              userId={user?.id}
              routeCategory={(selectedItem as RouteData).category}
              routeDistance={(selectedItem as RouteData).distance}
              availableRoutes={routes}
              routeLat={(selectedItem as RouteData).waypoints ? (() => { try { const w = typeof (selectedItem as RouteData).waypoints === 'string' ? JSON.parse((selectedItem as RouteData).waypoints) : (selectedItem as RouteData).waypoints; return Array.isArray(w) && w[0]?.lat ? w[0].lat : undefined } catch { return undefined } })() : undefined}
              routeLng={(selectedItem as RouteData).waypoints ? (() => { try { const w = typeof (selectedItem as RouteData).waypoints === 'string' ? JSON.parse((selectedItem as RouteData).waypoints) : (selectedItem as RouteData).waypoints; return Array.isArray(w) && w[0]?.lng ? w[0].lng : undefined } catch { return undefined } })() : undefined}
            />
          )}
          {featureTab === 'roi' && (selectedType !== 'route' || !selectedItem) && (
            <div className="text-center py-8">
              <BarChart3 className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Izberite ruto za ROI analizo</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Odprite podrobnosti rute in nato priročnik ROI</p>
              {routes.length > 0 && (
                <div className="mt-4">
                  <RouteRoiPanel
                    routeId={routes[0].id}
                    userId={user?.id}
                    routeCategory={routes[0].category}
                    routeDistance={routes[0].distance}
                    availableRoutes={routes}
                    routeLat={(() => { try { const w = typeof routes[0].waypoints === 'string' ? JSON.parse(routes[0].waypoints) : routes[0].waypoints; return Array.isArray(w) && w[0]?.lat ? w[0].lat : undefined } catch { return undefined } })()}
                    routeLng={(() => { try { const w = typeof routes[0].waypoints === 'string' ? JSON.parse(routes[0].waypoints) : routes[0].waypoints; return Array.isArray(w) && w[0]?.lng ? w[0].lng : undefined } catch { return undefined } })()}
                  />
                </div>
              )}
            </div>
          )}
          {featureTab === 'video' && (
            <VideoSyncPanel userId={user?.id} />
          )}
          {featureTab === 'live' && (
            <div className="space-y-4">
              <LiveTrackingPanel userId={user?.id} />
              <LiveTrackingViewer />
            </div>
          )}
          {featureTab === 'sync' && (
            <OfflineSyncPanel userId={user?.id} />
          )}
        </div>
      </div>
    </div>
  )
}
