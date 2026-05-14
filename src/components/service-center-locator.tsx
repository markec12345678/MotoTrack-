'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Wrench, X, Phone, Navigation, Star, Filter, MapPin } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { ServiceCenterData } from '@/components/tabs/types'

interface ServiceCenterLocatorProps {
  centers: ServiceCenterData[]
  onClose?: () => void
  onNavigate?: (lat: number, lng: number) => void
}

const BRANDS = [
  { key: 'all', label: 'Vse znamke', emoji: '🏍️' },
  { key: 'BMW', label: 'BMW', emoji: '🔵' },
  { key: 'Honda', label: 'Honda', emoji: '🔴' },
  { key: 'Yamaha', label: 'Yamaha', emoji: '🟡' },
  { key: 'Kawasaki', label: 'Kawasaki', emoji: '🟢' },
  { key: 'Suzuki', label: 'Suzuki', emoji: '🔵' },
  { key: 'KTM', label: 'KTM', emoji: '🟠' },
  { key: 'Ducati', label: 'Ducati', emoji: '🔴' },
  { key: 'Univerzalen', label: 'Univerzalen', emoji: '🔧' },
]

const SERVICE_LABELS: Record<string, string> = {
  servis: 'Servis',
  gume: 'Gume',
  olje: 'Olje',
  deli: 'Rezervni deli',
  diagnoza: 'Diagnoza',
  karoserija: 'Karoserija',
  elektrika: 'Elektrika',
}

export default function ServiceCenterLocator({ centers, onClose, onNavigate }: ServiceCenterLocatorProps) {
  const [brandFilter, setBrandFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)

  const filteredCenters = centers.filter(c => {
    if (brandFilter !== 'all') {
      if (brandFilter === 'Univerzalen') {
        if (c.brand) return false
      } else if (c.brand !== brandFilter) {
        return false
      }
    }
    if (serviceFilter && !c.services.includes(serviceFilter)) return false
    return true
  })

  // Get all unique services
  const allServices = Array.from(new Set(centers.flatMap(c => c.services)))

  const renderStars = (rating: number) => {
    const full = Math.floor(rating)
    const half = rating % 1 >= 0.5 ? 1 : 0
    const empty = 5 - full - half
    return (
      <span className="text-[10px]">
        {'★'.repeat(full)}{'½'.repeat(half)}{'☆'.repeat(empty)}
        <span className="ml-1 text-muted-foreground">{rating.toFixed(1)}</span>
      </span>
    )
  }

  return (
    <Card className="w-80 overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-emerald-500/80 via-teal-400/60 to-cyan-500/40" />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/15">
              <Wrench className="size-4 text-emerald-500" />
            </div>
            <CardTitle className="text-sm">Servisi</CardTitle>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {filteredCenters.length}
            </Badge>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Filter className="size-3 text-muted-foreground shrink-0" />
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="h-7 text-[10px] flex-1">
                <SelectValue placeholder="Znamka" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map(b => (
                  <SelectItem key={b.key} value={b.key} className="text-xs">
                    {b.emoji} {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setServiceFilter(null)}
              className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                !serviceFilter ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Vse
            </button>
            {allServices.map(s => (
              <button
                key={s}
                onClick={() => setServiceFilter(serviceFilter === s ? null : s)}
                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  serviceFilter === s ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {SERVICE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Center list */}
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {filteredCenters.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Ni servisov za izbrane filtre</p>
            )}
            {filteredCenters.map(center => (
              <div
                key={center.id}
                className="rounded-lg border border-border/50 p-2.5 space-y-2 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/10 shrink-0 mt-0.5">
                    <Wrench className="size-3.5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight">{center.name}</p>
                    {center.brand && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 mt-0.5">
                        {center.brand}
                      </Badge>
                    )}
                  </div>
                  {center.distance !== undefined && (
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      <MapPin className="size-2.5" />
                      {center.distance < 1 ? `${Math.round(center.distance * 1000)} m` : `${center.distance} km`}
                    </div>
                  )}
                </div>

                {/* Services */}
                {center.services.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {center.services.map(s => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      >
                        {SERVICE_LABELS[s] || s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-1">
                  <Star className="size-3 text-amber-500" />
                  {renderStars(center.rating)}
                </div>

                {/* Address */}
                {center.address && (
                  <p className="text-[9px] text-muted-foreground">{center.address}</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {center.phone && (
                    <a
                      href={`tel:${center.phone}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Phone className="size-2.5" /> {center.phone}
                    </a>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(center.lat, center.lng)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Navigation className="size-2.5" /> Navigiraj
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
