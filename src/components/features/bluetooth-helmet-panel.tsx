'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bluetooth, Battery, Signal, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function BluetoothHelmetPanel() {
  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; battery: number }>>([])
  const [connected, setConnected] = useState<{ deviceId: string; name: string; battery: number; volume: number } | null>(null)
  const [volume, setVolume] = useState(70)

  const scan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) })
      const j = await res.json()
      if (j.data) setDevices(j.data)
    } catch { toast.error('Napaka pri iskanju') }
    setScanning(false)
  }

  const connect = async (deviceId: string, name: string) => {
    try {
      const res = await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', deviceId }) })
      const j = await res.json()
      if (j.data?.connected) {
        setConnected({ deviceId, name, battery: j.data.battery || 80, volume: j.data.volume || 70 })
        toast.success(`Povezano z ${name}`)
      }
    } catch { toast.error('Napaka pri povezovanju') }
  }

  const disconnect = async () => {
    await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
    setConnected(null)
    toast.success('Povezava prekinjena')
  }

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
      <div className="flex items-center gap-2 mb-3">
        <Bluetooth className="size-4 text-blue-500" />
        <span className="text-sm font-bold">Bluetooth čelada</span>
      </div>
      {connected ? (
        <div className="space-y-3">
          <div className="bg-blue-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Signal className="size-4 text-blue-500" />
              <span className="text-sm font-medium">{connected.name}</span>
              <Badge variant="outline" className="text-[9px] bg-green-500/20 text-green-400 border-green-500/30">Povezano</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs"><Battery className="size-3" /><span>{connected.battery}%</span></div>
          </div>
          <div>
            <Label className="text-xs">Glasnost: {volume}%</Label>
            <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500 bg-muted" />
          </div>
          <Button variant="outline" className="w-full gap-2 text-xs" onClick={disconnect}><X className="size-3" /> Prekini povezavo</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button className="w-full gap-2" onClick={scan} disabled={scanning}>
            <Bluetooth className={`size-4 ${scanning ? 'animate-pulse' : ''}`} /> {scanning ? 'Iščem...' : 'Išči naprave'}
          </Button>
          {devices.map(d => (
            <button key={d.id} onClick={() => connect(d.id, d.name)} className="w-full flex items-center gap-2 p-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
              <Bluetooth className="size-4 text-blue-500" />
              <div className="flex-1 text-left"><p className="text-xs font-medium">{d.name}</p><p className="text-[10px] text-muted-foreground">Baterija: {d.battery}%</p></div>
              <ChevronRight className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
