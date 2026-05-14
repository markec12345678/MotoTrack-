'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Cpu, Activity, Gauge, Thermometer, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function OBDDashboard() {
  const [connected, setConnected] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = async () => {
    try {
      const res = await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) })
      const j = await res.json()
      if (j.data?.connected) {
        setConnected(true)
        setDashboard(j.data.dashboard)
        intervalRef.current = setInterval(async () => {
          const r = await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard' }) })
          const d = await r.json()
          if (d.data) setDashboard(d.data)
        }, 2000)
      }
    } catch { toast.error('Napaka pri povezovanju') }
  }

  const disconnect = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
    setConnected(false)
    setDashboard(null)
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  if (!connected) {
    return <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={connect}><Cpu className="size-3" /> Poveži OBD</Button>
  }

  return (
    <div className="bg-card border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Cpu className="size-4 text-green-500" /><span className="text-xs font-bold text-green-500">OBD Povezano</span></div>
        <button onClick={disconnect} className="text-xs text-red-500 hover:underline">Prekini</button>
      </div>
      {dashboard && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><Activity className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.rpm}</p><p className="text-[9px] text-muted-foreground">RPM</p></div>
          <div><Gauge className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.speed}</p><p className="text-[9px] text-muted-foreground">km/h</p></div>
          <div><Thermometer className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.engineTemp}°</p><p className="text-[9px] text-muted-foreground">Temp</p></div>
          <div><Zap className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.batteryVoltage}V</p><p className="text-[9px] text-muted-foreground">Baterija</p></div>
        </div>
      )}
    </div>
  )
}
