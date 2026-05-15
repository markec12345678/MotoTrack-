'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Bike, Plus, Wrench, Gauge, Calendar, Fuel, Zap,
  Save, Trash2, ChevronDown, Edit3, CheckCircle2, AlertTriangle, X
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────
interface GarageBike {
  id: string
  name: string
  brand: string
  model: string
  year: number
  color: string
  type: string
  displacement: number // cc
  mileage: number
  fuelType: string
  fuelCapacity: number // liters
  avgConsumption: number // l/100km
  image: string // emoji
  dateAdded: string
  lastService: string
  nextServiceMileage: number
}

interface MaintenanceEntry {
  id: string
  bikeId: string
  type: string
  title: string
  date: string
  mileage: number
  cost: number
  notes: string
}

const BIKE_EMOJIS = ['🏍️', '🏍️', '🏎️', '🏍️‍💨', '⚡', '🔥', '💨']
const BIKE_TYPES = ['Sport', 'Naked', 'Adventure', 'Cruiser', 'Touring', 'Enduro', 'Scooter', 'Classic', 'Supermoto', 'Triple']
const FUEL_TYPES = ['Bencin', 'Dizel', 'Elektrika', 'Hibrid']
const MAINTENANCE_TYPES = [
  { value: 'oil_change', label: 'Zamenjava olja', icon: '🛢️' },
  { value: 'tire_change', label: 'Zamenjava pnevmatik', icon: '🛞' },
  { value: 'chain', label: 'Veriga/Zobniki', icon: '⛓️' },
  { value: 'brakes', label: 'Zavore', icon: '🛑' },
  { value: 'filter', label: 'Filter zraka', icon: '🌬️' },
  { value: 'battery', label: 'Baterija', icon: '🔋' },
  { value: 'coolant', label: 'Hladilna tekočina', icon: '💧' },
  { value: 'valves', label: 'Ventili', icon: '⚙️' },
  { value: 'suspension', label: 'Vzmetenje', icon: '🔧' },
  { value: 'inspection', label: 'Tehnični pregled', icon: '📋' },
  { value: 'other', label: 'Drugo', icon: '🔨' },
]

const DEFAULT_BIKES: GarageBike[] = [
  {
    id: 'bike-1',
    name: 'Moj motocikel',
    brand: 'Yamaha',
    model: 'MT-07',
    year: 2022,
    color: '#3b82f6',
    type: 'Naked',
    displacement: 689,
    mileage: 12500,
    fuelType: 'Bencin',
    fuelCapacity: 14,
    avgConsumption: 4.5,
    image: '🏍️',
    dateAdded: new Date().toISOString(),
    lastService: '2024-09-15',
    nextServiceMileage: 15000,
  },
]

// ─── Local Storage helpers ───────────────────────────────────────────
function loadBikes(userId?: string): GarageBike[] {
  try {
    const key = `mototrack-garage-${userId || 'default'}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : DEFAULT_BIKES
  } catch {
    return DEFAULT_BIKES
  }
}

function saveBikes(bikes: GarageBike[], userId?: string) {
  try {
    const key = `mototrack-garage-${userId || 'default'}`
    localStorage.setItem(key, JSON.stringify(bikes))
  } catch { /* ignore */ }
}

function loadMaintenance(bikeId: string, userId?: string): MaintenanceEntry[] {
  try {
    const key = `mototrack-maintenance-${userId || 'default'}-${bikeId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveMaintenance(entries: MaintenanceEntry[], bikeId: string, userId?: string) {
  try {
    const key = `mototrack-maintenance-${userId || 'default'}-${bikeId}`
    localStorage.setItem(key, JSON.stringify(entries))
  } catch { /* ignore */ }
}

// ─── Component ──────────────────────────────────────────────────────
interface BikeGarageProps {
  userId?: string
  currentMileage?: number
}

export default function BikeGarage({ userId, currentMileage }: BikeGarageProps) {
  // Load bikes - derive from localStorage using useState initializer
  const [bikes, setBikes] = useState<GarageBike[]>(() => loadBikes(userId))
  const [selectedBikeId, setSelectedBikeId] = useState<string>(() => {
    const loaded = loadBikes(userId)
    return loaded.length > 0 ? loaded[0].id : ''
  })
  const [showAddBike, setShowAddBike] = useState(false)
  const [showAddMaintenance, setShowAddMaintenance] = useState(false)
  const [editingBike, setEditingBike] = useState<string | null>(null)
  const [maintenanceVersion, setMaintenanceVersion] = useState(0)

  // New bike form
  const [newBike, setNewBike] = useState<Partial<GarageBike>>({
    name: '', brand: '', model: '', year: 2024, color: '#f97316', type: 'Naked',
    displacement: 600, mileage: 0, fuelType: 'Bencin', fuelCapacity: 15, avgConsumption: 5.0, image: '🏍️',
  })

  // New maintenance form
  const [newMaint, setNewMaint] = useState({
    type: 'oil_change', title: '', date: new Date().toISOString().split('T')[0], mileage: '', cost: '', notes: '',
  })

  // Derive maintenance from selected bike
  const maintenanceEntries = useMemo(
    () => selectedBikeId ? loadMaintenance(selectedBikeId, userId) : [],
    [selectedBikeId, userId, maintenanceVersion]
  )

  const selectedBike = bikes.find(b => b.id === selectedBikeId)

  // Add bike
  const handleAddBike = useCallback(() => {
    if (!newBike.brand || !newBike.model) {
      toast.error('Vnesite znamko in model')
      return
    }
    const bike: GarageBike = {
      id: `bike-${Date.now()}`,
      name: newBike.name || `${newBike.brand} ${newBike.model}`,
      brand: newBike.brand || '',
      model: newBike.model || '',
      year: newBike.year || 2024,
      color: newBike.color || '#f97316',
      type: newBike.type || 'Naked',
      displacement: newBike.displacement || 600,
      mileage: newBike.mileage || 0,
      fuelType: newBike.fuelType || 'Bencin',
      fuelCapacity: newBike.fuelCapacity || 15,
      avgConsumption: newBike.avgConsumption || 5.0,
      image: newBike.image || '🏍️',
      dateAdded: new Date().toISOString(),
      lastService: new Date().toISOString().split('T')[0],
      nextServiceMileage: (newBike.mileage || 0) + 5000,
    }
    const updated = [...bikes, bike]
    setBikes(updated)
    saveBikes(updated, userId)
    setSelectedBikeId(bike.id)
    setShowAddBike(false)
    setNewBike({ name: '', brand: '', model: '', year: 2024, color: '#f97316', type: 'Naked', displacement: 600, mileage: 0, fuelType: 'Bencin', fuelCapacity: 15, avgConsumption: 5.0, image: '🏍️' })
    toast.success('Motocikel dodan v garažo!')
  }, [newBike, bikes, userId])

  // Delete bike
  const handleDeleteBike = useCallback((bikeId: string) => {
    const updated = bikes.filter(b => b.id !== bikeId)
    setBikes(updated)
    saveBikes(updated, userId)
    if (selectedBikeId === bikeId) {
      setSelectedBikeId(updated.length > 0 ? updated[0].id : '')
    }
    toast.success('Motocikel odstranjen')
  }, [bikes, selectedBikeId, userId])

  // Add maintenance
  const handleAddMaintenance = useCallback(() => {
    if (!selectedBikeId || !newMaint.mileage) {
      toast.error('Vnesite kilometrino')
      return
    }
    const entry: MaintenanceEntry = {
      id: `maint-${Date.now()}`,
      bikeId: selectedBikeId,
      type: newMaint.type,
      title: newMaint.title || MAINTENANCE_TYPES.find(t => t.value === newMaint.type)?.label || '',
      date: newMaint.date,
      mileage: parseInt(newMaint.mileage) || 0,
      cost: parseFloat(newMaint.cost) || 0,
      notes: newMaint.notes,
    }
    const updated = [entry, ...maintenanceEntries]
    saveMaintenance(updated, selectedBikeId, userId)

    // Force re-render by updating bikes (which triggers maintenanceEntries memo)
    const bikesUpdated = bikes.map(b => {
      if (b.id === selectedBikeId) {
        return {
          ...b,
          lastService: newMaint.date,
          nextServiceMileage: Math.max(b.nextServiceMileage, (parseInt(newMaint.mileage) || 0) + 5000),
          mileage: Math.max(b.mileage, parseInt(newMaint.mileage) || 0),
        }
      }
      return b
    })
    setBikes(bikesUpdated)
    saveBikes(bikesUpdated, userId)
    setMaintenanceVersion(v => v + 1)

    setShowAddMaintenance(false)
    setNewMaint({ type: 'oil_change', title: '', date: new Date().toISOString().split('T')[0], mileage: '', cost: '', notes: '' })
    toast.success('Vzdrževanje zabeleženo!')
  }, [selectedBikeId, newMaint, maintenanceEntries, bikes, userId])

  // Service progress
  const serviceProgress = selectedBike
    ? Math.min(100, ((selectedBike.mileage - (selectedBike.nextServiceMileage - 5000)) / 5000) * 100)
    : 0

  const serviceNeeded = selectedBike ? selectedBike.mileage >= selectedBike.nextServiceMileage - 500 : false

  // Range estimation
  const estimatedRange = selectedBike ? Math.round((selectedBike.fuelCapacity / selectedBike.avgConsumption) * 100) : 0

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Bike className="size-3.5 text-primary" />
            </div>
            <div>
              <h4 className="text-xs font-semibold">Garaža</h4>
              <p className="text-[9px] text-muted-foreground">{bikes.length} motocikel</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={() => setShowAddBike(!showAddBike)}>
            <Plus className="size-3" /> Dodaj
          </Button>
        </div>

        {/* Bike selector tabs */}
        {bikes.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {bikes.map(bike => (
              <button
                key={bike.id}
                onClick={() => setSelectedBikeId(bike.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  selectedBikeId === bike.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                <span>{bike.image}</span>
                <span>{bike.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Add Bike Form */}
        {showAddBike && (
          <div className="space-y-2.5 p-3 bg-secondary/30 rounded-lg border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nov motocikel</span>
              <Button variant="ghost" size="icon" className="size-5" onClick={() => setShowAddBike(false)}>
                <X className="size-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[9px]">Znamka</Label>
                <Input
                  placeholder="Yamaha"
                  value={newBike.brand || ''}
                  onChange={e => setNewBike(prev => ({ ...prev, brand: e.target.value }))}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Model</Label>
                <Input
                  placeholder="MT-07"
                  value={newBike.model || ''}
                  onChange={e => setNewBike(prev => ({ ...prev, model: e.target.value }))}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Letnik</Label>
                <Input
                  type="number"
                  value={newBike.year || 2024}
                  onChange={e => setNewBike(prev => ({ ...prev, year: parseInt(e.target.value) || 2024 }))}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Tip</Label>
                <Select value={newBike.type} onValueChange={val => setNewBike(prev => ({ ...prev, type: val }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BIKE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Prostornina (cc)</Label>
                <Input
                  type="number"
                  value={newBike.displacement || 600}
                  onChange={e => setNewBike(prev => ({ ...prev, displacement: parseInt(e.target.value) || 600 }))}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Kilometrina</Label>
                <Input
                  type="number"
                  value={newBike.mileage || 0}
                  onChange={e => setNewBike(prev => ({ ...prev, mileage: parseInt(e.target.value) || 0 }))}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px]">Emoji</Label>
              <div className="flex gap-1.5">
                {BIKE_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setNewBike(prev => ({ ...prev, image: emoji }))}
                    className={`text-lg p-1 rounded transition-all ${newBike.image === emoji ? 'bg-primary/20 scale-110' : 'hover:bg-secondary'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full text-xs gap-1 h-7" onClick={handleAddBike}>
              <Save className="size-3" /> Shrani motocikel
            </Button>
          </div>
        )}

        {/* Selected Bike Details */}
        {selectedBike ? (
          <div className="space-y-3">
            {/* Bike card */}
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <div className="h-1" style={{ backgroundColor: selectedBike.color }} />
              <div className="p-3 space-y-3">
                {/* Name + brand */}
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{selectedBike.image}</div>
                  <div className="flex-1">
                    <h5 className="text-sm font-bold">{selectedBike.brand} {selectedBike.model}</h5>
                    <p className="text-[10px] text-muted-foreground">{selectedBike.year} • {selectedBike.type} • {selectedBike.displacement}cc</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => handleDeleteBike(selectedBike.id)} title="Izbriši">
                      <Trash2 className="size-3 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center bg-secondary/40 rounded-md py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Gauge className="size-3 text-primary" />
                      <span className="text-sm font-bold">{selectedBike.mileage.toLocaleString()}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">km</span>
                  </div>
                  <div className="text-center bg-secondary/40 rounded-md py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Fuel className="size-3 text-primary" />
                      <span className="text-sm font-bold">{selectedBike.avgConsumption}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">l/100km</span>
                  </div>
                  <div className="text-center bg-secondary/40 rounded-md py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="size-3 text-primary" />
                      <span className="text-sm font-bold">{estimatedRange}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">km doseg</span>
                  </div>
                </div>

                {/* Service progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Wrench className="size-3" />
                      Naslednje servisiranje
                    </span>
                    <span className={`text-[10px] font-semibold ${serviceNeeded ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {serviceNeeded ? 'Potrebno!' : `pri ${selectedBike.nextServiceMileage.toLocaleString()} km`}
                    </span>
                  </div>
                  <Progress value={Math.min(100, serviceProgress)} className={`h-1.5 ${serviceNeeded ? '[&>div]:bg-red-500' : ''}`} />
                  {serviceNeeded && (
                    <div className="flex items-center gap-1 text-[10px] text-red-400">
                      <AlertTriangle className="size-3" />
                      <span>Kilometrina za servis presežena!</span>
                    </div>
                  )}
                </div>

                {/* Fuel capacity info */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Rezervoar: {selectedBike.fuelCapacity}L</span>
                  <span>Gorivo: {selectedBike.fuelType}</span>
                  <span>Zadnji servis: {selectedBike.lastService}</span>
                </div>
              </div>
            </div>

            {/* Maintenance Log */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Wrench className="size-3" /> Zgodovina vzdrževanja
                </h5>
                <Button variant="outline" size="sm" className="text-[9px] gap-1 h-5" onClick={() => setShowAddMaintenance(!showAddMaintenance)}>
                  <Plus className="size-2.5" /> Dodaj
                </Button>
              </div>

              {/* Add maintenance form */}
              {showAddMaintenance && (
                <div className="space-y-2 p-2.5 bg-secondary/30 rounded-lg border border-border/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9px]">Tip</Label>
                      <Select value={newMaint.type} onValueChange={val => setNewMaint(prev => ({ ...prev, type: val }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MAINTENANCE_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.icon} {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px]">Kilometrina</Label>
                      <Input
                        type="number"
                        placeholder="12500"
                        value={newMaint.mileage}
                        onChange={e => setNewMaint(prev => ({ ...prev, mileage: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px]">Datum</Label>
                      <Input
                        type="date"
                        value={newMaint.date}
                        onChange={e => setNewMaint(prev => ({ ...prev, date: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px]">Strošek (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="50"
                        value={newMaint.cost}
                        onChange={e => setNewMaint(prev => ({ ...prev, cost: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px]">Opombe</Label>
                    <Input
                      placeholder="Pol motornega olja 10W-40..."
                      value={newMaint.notes}
                      onChange={e => setNewMaint(prev => ({ ...prev, notes: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                  <Button size="sm" className="w-full text-xs gap-1 h-7" onClick={handleAddMaintenance}>
                    <Save className="size-3" /> Shrani
                  </Button>
                </div>
              )}

              {/* Entries list */}
              {maintenanceEntries.length === 0 ? (
                <div className="text-center py-4">
                  <Wrench className="size-6 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Ni vnosa vzdrževanja</p>
                  <p className="text-[9px] text-muted-foreground/50">Dodajte prvi vnos za sledenje</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {maintenanceEntries.map(entry => {
                    const mType = MAINTENANCE_TYPES.find(t => t.value === entry.type)
                    return (
                      <div key={entry.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <span className="text-sm">{mType?.icon || '🔨'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium truncate">{entry.title || mType?.label}</span>
                            {entry.cost > 0 && <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5">{entry.cost}€</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                            <span>{entry.date}</span>
                            <span>•</span>
                            <span>{entry.mileage.toLocaleString()} km</span>
                          </div>
                        </div>
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Maintenance cost summary */}
              {maintenanceEntries.length > 0 && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>Skupaj: {maintenanceEntries.reduce((s, e) => s + e.cost, 0).toFixed(2)}€</span>
                  <span>{maintenanceEntries.length} vnosov</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Bike className="size-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Garaža je prazna</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Dodajte svoj motocikel za sledenje vzdrževanja</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
