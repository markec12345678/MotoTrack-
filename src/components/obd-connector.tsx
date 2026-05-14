'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Cable, Gauge, Thermometer, Battery, Fuel, AlertTriangle, X, Activity, Wifi, WifiOff, Trash2, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface ObdData {
  rpm: number
  speed: number
  engineTemp: number
  fuelLevel: number
  batteryVoltage: number
  dtcs: Array<{ code: string; description: string }>
  connectionStatus: 'connected' | 'disconnected' | 'simulated'
  lastUpdate: string
}

interface ObdConnectorProps {
  onClose?: () => void
}

// Animated gauge component
function AnimatedGauge({ value, max, label, unit, color, icon: Icon }: {
  value: number
  max: number
  label: string
  unit: string
  color: string
  icon: React.ElementType
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const angle = (percentage / 100) * 270 - 135

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        {/* Gauge background arc */}
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/20"
            strokeDasharray={`${270 * 0.628} ${360 * 0.628}`}
            strokeLinecap="round"
          />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${(percentage / 100) * 270 * 0.628} ${360 * 0.628}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        {/* Needle */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="w-0.5 h-8 origin-bottom rounded-full" style={{ backgroundColor: color, transition: 'transform 0.5s ease' }} />
        </div>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="size-3 mb-0.5" style={{ color }} />
          <span className="text-sm font-bold leading-none">{Math.round(value)}</span>
          <span className="text-[8px] text-muted-foreground leading-none">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

export default function ObdConnector({ onClose }: ObdConnectorProps) {
  const [obdData, setObdData] = useState<ObdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [serialSupported, setSerialSupported] = useState(false)
  const [dataLog, setDataLog] = useState<Array<{ time: string; rpm: number; speed: number; temp: number }>>([])
  const [showLog, setShowLog] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check Web Serial API support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSerialSupported(true)
    }
  }, [])

  // Fetch OBD data
  const fetchObdData = useCallback(async () => {
    try {
      const res = await fetch('/api/obd?mode=simulated')
      if (res.ok) {
        const j = await res.json()
        setObdData(j.data)
        // Add to data log
        if (j.data) {
          setDataLog(prev => {
            const entry = {
              time: new Date().toLocaleTimeString('sl-SI'),
              rpm: j.data.rpm,
              speed: j.data.speed,
              temp: j.data.engineTemp,
            }
            const newLog = [entry, ...prev].slice(0, 60)
            return newLog
          })
        }
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  // Initial fetch and auto-refresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchObdData()
    intervalRef.current = setInterval(fetchObdData, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchObdData])

  // Connect via Web Serial API
  const connectSerial = async () => {
    if (!serialSupported) {
      toast.error('Brskalnik ne podpira Web Serial API')
      return
    }
    setIsConnecting(true)
    try {
      // @ts-ignore - Web Serial API types not available
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 38400 })
      toast.success('OBD adapter povezan!')
      // In production, we'd read data from the serial port here
      // For now, we fall back to simulation
    } catch (err) {
      toast.error('Napaka pri povezovanju z OBD adapterjem')
      console.error(err)
    }
    setIsConnecting(false)
  }

  // Clear DTC codes
  const clearDtcCodes = async () => {
    try {
      const res = await fetch('/api/obd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_dtcs' }),
      })
      if (res.ok) {
        toast.success('Kode napak izbrisane')
        fetchObdData()
      }
    } catch {
      toast.error('Napaka pri brisanju kod')
    }
  }

  // Export data log
  const exportLog = async () => {
    try {
      await fetch('/api/obd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_data' }),
      })
      toast.success('Podatki zabeleženi')
    } catch {
      toast.error('Napaka pri beleženju')
    }
  }

  if (loading) {
    return (
      <Card className="w-80">
        <CardContent className="p-4 flex items-center justify-center h-48">
          <Activity className="size-8 text-muted-foreground animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const statusColor = obdData?.connectionStatus === 'simulated' ? '#f59e0b' : obdData?.connectionStatus === 'connected' ? '#22c55e' : '#ef4444'
  const statusLabel = obdData?.connectionStatus === 'simulated' ? 'Simulacija' : obdData?.connectionStatus === 'connected' ? 'Povezano' : 'Nepovezano'

  return (
    <Card className="w-80 overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-primary/80 via-amber-400/60 to-primary/40" />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Cable className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm">OBD-II Povezava</CardTitle>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 gap-1"
              style={{ borderColor: statusColor, color: statusColor }}
            >
              <div className="size-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {statusLabel}
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
        {/* Dashboard gauges */}
        <div className="grid grid-cols-3 gap-2">
          <AnimatedGauge
            value={obdData?.rpm || 0}
            max={14000}
            label="Vrtljaji"
            unit="RPM"
            color="#f59e0b"
            icon={Gauge}
          />
          <AnimatedGauge
            value={obdData?.speed || 0}
            max={250}
            label="Hitrost"
            unit="km/h"
            color="#22c55e"
            icon={Activity}
          />
          <AnimatedGauge
            value={obdData?.engineTemp || 0}
            max={130}
            label="Temp. motorja"
            unit="°C"
            color={obdData && obdData.engineTemp > 105 ? '#ef4444' : '#3b82f6'}
            icon={Thermometer}
          />
        </div>

        {/* Fuel and Battery bars */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Fuel className="size-3 text-orange-500" />
                <span className="text-[10px] font-medium">Gorivo</span>
              </div>
              <span className="text-[10px] font-bold">{obdData?.fuelLevel || 0}%</span>
            </div>
            <Progress value={obdData?.fuelLevel || 0} className="h-2" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Battery className="size-3 text-green-500" />
                <span className="text-[10px] font-medium">Baterija</span>
              </div>
              <span className="text-[10px] font-bold">{obdData?.batteryVoltage?.toFixed(1) || '0.0'}V</span>
            </div>
            <Progress value={obdData ? (obdData.batteryVoltage / 16) * 100 : 0} className="h-2" />
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* DTC Codes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span className="text-xs font-medium">Kode napak (DTC)</span>
            </div>
            {obdData && obdData.dtcs.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-red-300 text-red-500">
                {obdData.dtcs.length}
              </Badge>
            )}
          </div>

          {obdData && obdData.dtcs.length > 0 ? (
            <div className="space-y-1">
              {obdData.dtcs.map((dtc, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] font-mono font-bold text-red-500">{dtc.code}</span>
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{dtc.description}</span>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[10px] gap-1 h-7 mt-1"
                onClick={clearDtcCodes}
              >
                <Trash2 className="size-3" /> Izbriši kode
              </Button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center py-2">✅ Ni aktivnih kod napak</p>
          )}
        </div>

        <Separator className="opacity-30" />

        {/* Connection buttons */}
        <div className="space-y-2">
          {serialSupported ? (
            <Button
              size="sm"
              className="w-full text-[10px] gap-1.5 h-8"
              onClick={connectSerial}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <><Activity className="size-3 animate-pulse" /> Povezujem...</>
              ) : (
                <><Wifi className="size-3" /> Poveži OBD adapter</>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 justify-center text-[10px] text-muted-foreground py-1">
              <WifiOff className="size-3" />
              <span>Web Serial API ni podprt v tem brskalniku</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-[10px] gap-1 h-7"
              onClick={() => setShowLog(!showLog)}
            >
              <Activity className="size-3" /> {showLog ? 'Skrij dnevnik' : 'Dnevnik'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-[10px] gap-1 h-7"
              onClick={exportLog}
            >
              <Download className="size-3" /> Zabeleži
            </Button>
          </div>
        </div>

        {/* Data log */}
        {showLog && dataLog.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <ScrollArea className="max-h-32">
              <div className="space-y-0.5">
                {dataLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground px-1 py-0.5">
                    <span className="w-14 shrink-0">{entry.time}</span>
                    <span className="text-amber-500 w-12">{entry.rpm} RPM</span>
                    <span className="text-green-500 w-14">{entry.speed} km/h</span>
                    <span className="text-blue-500">{entry.temp}°C</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Last update */}
        <p className="text-[8px] text-muted-foreground text-center">
          Zadnja posodobitev: {obdData?.lastUpdate ? new Date(obdData.lastUpdate).toLocaleTimeString('sl-SI') : '-'}
        </p>
      </CardContent>
    </Card>
  )
}
