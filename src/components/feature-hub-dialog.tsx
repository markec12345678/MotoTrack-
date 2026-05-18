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
  Mic,
  Activity,
  Sun,
  Download,
  Film,
} from 'lucide-react'
import type { RideData, RouteData } from '@/components/tabs/types'

// Lazy load feature panels - these are heavy and only needed when feature hub is open
const SmartRecommendationsPanel = dynamic(() => import('@/components/smart-recommendations-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const VideoSyncPanel = dynamic(() => import('@/components/video-sync-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const OfflineSyncPanel = dynamic(() => import('@/components/offline-sync-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const RouteRoiPanel = dynamic(() => import('@/components/route-roi-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const LiveTrackingPanel = dynamic(() => import('@/components/live-tracking-panel'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })
const LiveTrackingViewer = dynamic(() => import('@/components/live-tracking-viewer'), { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> })

type FeatureTab = 'roi' | 'smart' | 'video' | 'live' | 'sync' | 'voice' | 'twistiness' | 'theme' | 'export' | 'simulator'

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
  voiceEnabled?: boolean
  onToggleVoice?: (enabled: boolean) => void
  autoThemeEnabled?: boolean
  onToggleAutoTheme?: (enabled: boolean) => void
  showTwistiness?: boolean
  onToggleTwistiness?: (show: boolean) => void
  onOpenExport?: () => void
  onOpenSimulator?: () => void
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
  voiceEnabled,
  onToggleVoice,
  autoThemeEnabled,
  onToggleAutoTheme,
  showTwistiness,
  onToggleTwistiness,
  onOpenExport,
  onOpenSimulator,
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
            { id: 'voice' as const, label: 'Glas', icon: Mic },
            { id: 'twistiness' as const, label: 'Vijugavost', icon: Activity },
            { id: 'theme' as const, label: 'Tema', icon: Sun },
            { id: 'export' as const, label: 'Izvoz', icon: Download },
            { id: 'simulator' as const, label: 'Simulator', icon: Film },
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
          {featureTab === 'voice' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center size-10 rounded-xl ${voiceEnabled ? 'bg-red-500/20' : 'bg-muted'}`}>
                    <Mic className={`size-5 ${voiceEnabled ? 'text-red-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Glasovni ukazi</h3>
                    <p className="text-xs text-muted-foreground">{voiceEnabled ? 'Aktivni — rečite ukaz v slovenščini' : 'Roke na volanu, nadzirajte z glasom'}</p>
                  </div>
                </div>
                <Button
                  variant={voiceEnabled ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => onToggleVoice?.(!voiceEnabled)}
                >
                  {voiceEnabled ? 'Izklopi' : 'Vklopi'}
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Podprti ukazi</h4>
                {[
                  { cmd: '"Začni sledenje"', desc: 'Začne snemanje vožnje' },
                  { cmd: '"Ustavi"', desc: 'Ustavi sledenje' },
                  { cmd: '"Pavza"', desc: 'Premor sledenja' },
                  { cmd: '"Nadaljuj"', desc: 'Nadaljuj sledenje' },
                  { cmd: '"Kje sem"', desc: 'Pove trenutno lokacijo' },
                  { cmd: '"Hitrost"', desc: 'Pove trenutno hitrost' },
                  { cmd: '"Vreme"', desc: 'Pove trenutno vreme' },
                  { cmd: '"Nevarnost"', desc: 'Prijavi nevarnost na cesti' },
                  { cmd: '"SOS"', desc: 'Odpri nujno pomoč' },
                  { cmd: '"Shrani"', desc: 'Shrani trenutno vožnjo' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50">
                    <span className="text-xs font-mono text-primary">{item.cmd}</span>
                    <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {featureTab === 'twistiness' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center size-10 rounded-xl ${showTwistiness ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                    <Activity className={`size-5 ${showTwistiness ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Heatmap vijugavosti</h3>
                    <p className="text-xs text-muted-foreground">Vizualizacija zabavnosti cest na zemljevidu</p>
                  </div>
                </div>
                <Button
                  variant={showTwistiness ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToggleTwistiness?.(!showTwistiness)}
                >
                  {showTwistiness ? 'Skrij' : 'Prikaži'}
                </Button>
              </div>
              <div className="p-3 rounded-xl border border-border/50 bg-secondary/20">
                <h4 className="text-xs font-bold mb-2">Barvna lestvica</h4>
                <div className="space-y-1.5">
                  {[
                    { color: 'bg-emerald-500', label: 'Ekstremno vijugasta 🔥', score: '80+' },
                    { color: 'bg-green-500', label: 'Zelo vijugasta 🐍', score: '60-80' },
                    { color: 'bg-yellow-500', label: 'Vijugasta 🌀', score: '40-60' },
                    { color: 'bg-orange-500', label: 'Rahlo vijugasta ↪️', score: '20-40' },
                    { color: 'bg-red-500', label: 'Ravna cesta ➡️', score: '0-20' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`size-3 rounded-sm ${item.color}`} />
                      <span className="text-xs">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{item.score}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Zelena = zabavna, Rdeča = dolgočasna</p>
              </div>
            </div>
          )}
          {featureTab === 'theme' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center size-10 rounded-xl ${autoThemeEnabled ? 'bg-amber-500/20' : 'bg-muted'}`}>
                    <Sun className={`size-5 ${autoThemeEnabled ? 'text-amber-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Samodejna tema (dan/noč)</h3>
                    <p className="text-xs text-muted-foreground">Preklaplja glede na sončni vzhod in zahod</p>
                  </div>
                </div>
                <Button
                  variant={autoThemeEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToggleAutoTheme?.(!autoThemeEnabled)}
                >
                  {autoThemeEnabled ? 'Izklopi' : 'Vklopi'}
                </Button>
              </div>
              {autoThemeEnabled && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs text-amber-600 dark:text-amber-400">☀️ Podnevi bo tema svetla, ponoči temna. Lokacija: {userLat?.toFixed(2) ?? '46.06'}°N, {userLng?.toFixed(2) ?? '14.51'}°E</p>
                </div>
              )}
            </div>
          )}
          {featureTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold">Izvoz voženj in poti</h3>
              <p className="text-xs text-muted-foreground">Izvozite podatke v formatu, ki je združljiv z vašo najljubšo aplikacijo</p>
              <div className="grid gap-2">
                {[
                  { format: 'GPX', desc: 'Splošni GPS format', platforms: 'OsmAnd, Kurviger, REVER', color: 'text-emerald-400' },
                  { format: 'TCX', desc: 'Strava optimalen format', platforms: 'Strava, Garmin', color: 'text-orange-400' },
                  { format: 'KML', desc: 'Google Earth format', platforms: 'Google Earth, Maps', color: 'text-sky-400' },
                  { format: 'CSV', desc: 'Pregledniški format', platforms: 'Excel, LibreOffice', color: 'text-violet-400' },
                ].map((fmt, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
                    <span className={`text-sm font-black ${fmt.color}`}>.{fmt.format.toLowerCase()}</span>
                    <div className="flex-1">
                      <span className="text-xs font-medium">{fmt.format} — {fmt.desc}</span>
                      <p className="text-[10px] text-muted-foreground">{fmt.platforms}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2" onClick={() => { onOpenExport?.(); onClose() }}>
                <Download className="size-4" />
                Izvozi vožnjo
              </Button>
            </div>
          )}
          {featureTab === 'simulator' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold">Simulacija rute</h3>
              <p className="text-xs text-muted-foreground">Animirani let nad ruto s prikazom hitrosti, višine in vijugavosti</p>
              <div className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <Film className="size-8 text-orange-400" />
                  <div>
                    <h4 className="text-sm font-bold">Animated Flyover</h4>
                    <p className="text-xs text-muted-foreground">Pregled rute pred vožnjo</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-secondary/50 text-center">
                    <p className="font-bold text-orange-400">Hitrost</p>
                    <p className="text-[10px] text-muted-foreground">Simulirana glede na ovire</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 text-center">
                    <p className="font-bold text-sky-400">Višina</p>
                    <p className="text-[10px] text-muted-foreground">Profil nadmorske višine</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 text-center">
                    <p className="font-bold text-emerald-400">Vijugavost</p>
                    <p className="text-[10px] text-muted-foreground">Ocena zabavnosti ceste</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 text-center">
                    <p className="font-bold text-purple-400">Smer</p>
                    <p className="text-[10px] text-muted-foreground">Sever/Jug/Vzhod/Zahod</p>
                  </div>
                </div>
              </div>
              <Button className="w-full gap-2" onClick={() => { onOpenSimulator?.(); onClose() }}>
                <Film className="size-4" />
                Zaženi simulator
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
