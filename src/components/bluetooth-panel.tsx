'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Bluetooth, Volume2, Phone, MessageSquare, Battery, Signal, Headphones } from 'lucide-react'
import { toast } from 'sonner'

export default function BluetoothPanel() {
  const [connected, setConnected] = useState(false)
  const [deviceType, setDeviceType] = useState('cardo')
  const [deviceName, setDeviceName] = useState('')
  const [voiceNav, setVoiceNav] = useState(true)
  const [voiceCalls, setVoiceCalls] = useState(true)
  const [volume, setVolume] = useState([70])

  const handleConnect = async () => {
    try {
      // Try Web Bluetooth API (limited browser support)
      if ('bluetooth' in navigator) {
        toast.info('Iskanje Bluetooth naprav...')
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'generic_access']
        })
        setDeviceName(device.name || 'Neznana naprava')
        setConnected(true)
        toast.success(`Povezano: ${device.name || 'Naprava'}`)
      } else {
        // Fallback: simulate connection
        const name = deviceType === 'cardo' ? 'Cardo Packtalk' : deviceType === 'sena' ? 'Sena 50S' : 'Bluetooth čelada'
        setDeviceName(name)
        setConnected(true)
        toast.success(`Simulirana povezava: ${name}`)
      }
    } catch (err: unknown) {
      toast.error('Napaka pri povezovanju: ' + (err instanceof Error ? err.message : 'Brah'))
    }
  }

  const handleDisconnect = () => {
    setConnected(false)
    setDeviceName('')
    toast.info('Bluetooth odklopljen')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bluetooth className="size-4 text-sky-500" />
          Bluetooth čelada
          {connected && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Povezano</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Device Selection */}
        <div className="flex items-center gap-2">
          <Select value={deviceType} onValueChange={setDeviceType} disabled={connected}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cardo">Cardo Systems</SelectItem>
              <SelectItem value="sena">Sena Technologies</SelectItem>
              <SelectItem value="other">Drugo</SelectItem>
            </SelectContent>
          </Select>
          {!connected ? (
            <Button size="sm" onClick={handleConnect} className="h-8 text-xs">
              <Bluetooth className="size-3 mr-1" /> Poveži
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleDisconnect} className="h-8 text-xs">
              Odklopi
            </Button>
          )}
        </div>

        {/* Connection Status */}
        {connected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Headphones className="size-4 text-sky-500" />
              <div className="flex-1">
                <div className="text-xs font-semibold">{deviceName}</div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Signal className="size-3 text-emerald-500" /> Povezano
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{deviceType.toUpperCase()}</Badge>
            </div>

            {/* Audio Settings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1"><Volume2 className="size-3" /> Glas. navodila</span>
                <Switch checked={voiceNav} onCheckedChange={setVoiceNav} className="scale-75" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-1"><Phone className="size-3" /> Klici</span>
                <Switch checked={voiceCalls} onCheckedChange={setVoiceCalls} className="scale-75" />
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="size-3 text-muted-foreground" />
                <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={5} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8 text-right">{volume[0]}%</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          ℹ️ Web Bluetooth API je podprt le v Chrome/Edge. V drugih brskalnikih je na voljo simulirana povezava.
        </p>
      </CardContent>
    </Card>
  )
}
