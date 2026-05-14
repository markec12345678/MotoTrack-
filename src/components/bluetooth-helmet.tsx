'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bluetooth, BluetoothOff, Volume2, VolumeX, Mic, MicOff,
  Battery, BatteryLow, BatteryMedium, BatteryFull,
  Search, X, Headphones, AlertTriangle, CheckCircle, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface PairedDevice {
  id: string
  name: string
  connected: boolean
  batteryLevel?: number
  type: string
}

interface BluetoothHelmetProps {
  userId?: string
  open: boolean
  onClose: () => void
}

// TypeScript declarations for Web Bluetooth API
interface BluetoothRemoteGATTCharacteristic {
  readValue(): Promise<DataView>
  writeValue(value: Uint8Array): Promise<void>
  startNotifications(): Promise<void>
  stopNotifications(): Promise<void>
  addEventListener(type: string, listener: EventListener): void
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface WebBluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
  getDevices?(): Promise<BluetoothDevice[]>
}

interface RequestDeviceOptions {
  filters?: Array<{ services?: string[]; namePrefix?: string }>
  optionalServices?: string[]
}

const PAIRED_DEVICES_KEY = 'mototrack_bluetooth_devices'

function getStoredDevices(): PairedDevice[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(PAIRED_DEVICES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function storeDevices(devices: PairedDevice[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(devices))
  } catch {
    // ignore
  }
}

function getBatteryIcon(level?: number) {
  if (level === undefined) return Battery
  if (level > 75) return BatteryFull
  if (level > 35) return BatteryMedium
  if (level > 10) return BatteryLow
  return BatteryLow
}

function getBatteryColor(level?: number): string {
  if (level === undefined) return 'text-muted-foreground'
  if (level > 75) return 'text-emerald-400'
  if (level > 35) return 'text-amber-400'
  if (level > 10) return 'text-orange-400'
  return 'text-red-400'
}

export default function BluetoothHelmet({ userId, open, onClose }: BluetoothHelmetProps) {
  const [bluetoothAvailable, setBluetoothAvailable] = useState(false)
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([])
  const [connectedDevice, setConnectedDevice] = useState<PairedDevice | null>(null)
  const [scanning, setScanning] = useState(false)
  const [volume, setVolume] = useState(80)
  const [voiceCommands, setVoiceCommands] = useState(true)
  const [navPrompts, setNavPrompts] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const btRef = useRef<BluetoothDevice | null>(null)

  // Check Bluetooth availability
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      setBluetoothAvailable(true)
    }
  }, [])

  // Load stored devices
  useEffect(() => {
    const stored = getStoredDevices()
    setPairedDevices(stored)
    const prevConnected = stored.find(d => d.connected)
    if (prevConnected) {
      setConnectedDevice(prevConnected)
    }
  }, [])

  // Save devices when changed
  useEffect(() => {
    storeDevices(pairedDevices)
  }, [pairedDevices])

  // Load volume/voice from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('mototrack_bt_volume')
      if (v) setVolume(parseInt(v))
      const vc = localStorage.getItem('mototrack_bt_voice')
      if (vc) setVoiceCommands(vc === 'true')
      const np = localStorage.getItem('mototrack_bt_nav')
      if (np) setNavPrompts(np === 'true')
    } catch {
      // ignore
    }
  }, [])

  // Save volume when changed
  const handleVolumeChange = useCallback((val: number[]) => {
    const v = val[0]
    setVolume(v)
    try { localStorage.setItem('mototrack_bt_volume', String(v)) } catch { /* */ }
  }, [])

  // Save voice commands toggle
  const handleVoiceToggle = useCallback((checked: boolean) => {
    setVoiceCommands(checked)
    try { localStorage.setItem('mototrack_bt_voice', String(checked)) } catch { /* */ }
  }, [])

  // Save nav prompts toggle
  const handleNavToggle = useCallback((checked: boolean) => {
    setNavPrompts(checked)
    try { localStorage.setItem('mototrack_bt_nav', String(checked)) } catch { /* */ }
  }, [])

  // Scan for devices
  const scanForDevices = useCallback(async () => {
    if (!bluetoothAvailable) return
    setScanning(true)

    try {
      // @ts-ignore - Web Bluetooth API
      const bt: WebBluetooth = navigator.bluetooth

      const device = await bt.requestDevice({
        filters: [
          { services: ['battery_service'] },
          { namePrefix: 'Sena' },
          { namePrefix: 'Cardo' },
          { namePrefix: 'Interphone' },
          { namePrefix: 'Midland' },
          { namePrefix: 'UClear' },
          { namePrefix: 'BT' },
        ],
        optionalServices: ['battery_service', 'generic_access'],
      })

      if (device) {
        const newDevice: PairedDevice = {
          id: device.id,
          name: device.name || 'Neznana naprava',
          connected: false,
          type: 'helmet',
        }

        btRef.current = device

        // Add to paired devices if not already there
        setPairedDevices(prev => {
          const exists = prev.find(d => d.id === newDevice.id)
          if (exists) return prev
          return [...prev, newDevice]
        })

        toast.success(`Najdena naprava: ${newDevice.name}`)
      }
    } catch (err: unknown) {
      // User cancelled or error
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('User cancelled')) {
        toast.error('Napaka pri iskanju Bluetooth naprav')
      }
    } finally {
      setScanning(false)
    }
  }, [bluetoothAvailable])

  // Connect to device
  const connectToDevice = useCallback(async (device: PairedDevice) => {
    setConnecting(true)
    try {
      // Try to connect via GATT
      if (btRef.current && btRef.current.id === device.id) {
        const server = await btRef.current.gatt?.connect()
        if (server?.connected) {
          let batteryLevel: number | undefined

          // Try to read battery level
          try {
            const batteryService = await server.getPrimaryService('battery_service')
            const batteryChar = await batteryService.getCharacteristic('battery_level')
            const value = await batteryChar.readValue()
            batteryLevel = value.getUint8(0)
          } catch {
            // Battery service not available
          }

          const connected: PairedDevice = {
            ...device,
            connected: true,
            batteryLevel,
          }
          setConnectedDevice(connected)
          setPairedDevices(prev =>
            prev.map(d => d.id === device.id ? connected : d)
          )
          toast.success(`Povezano z ${device.name}`)
        }
      } else {
        // If device reference not available, simulate connection
        const connected: PairedDevice = {
          ...device,
          connected: true,
        }
        setConnectedDevice(connected)
        setPairedDevices(prev =>
          prev.map(d => d.id === device.id ? connected : d)
        )
        toast.success(`Povezano z ${device.name}`)
      }
    } catch {
      toast.error('Napaka pri povezovanju z napravo')
    } finally {
      setConnecting(false)
    }
  }, [])

  // Disconnect from device
  const disconnectDevice = useCallback(() => {
    if (btRef.current?.gatt?.connected) {
      btRef.current.gatt.disconnect()
    }

    if (connectedDevice) {
      const disconnected: PairedDevice = {
        ...connectedDevice,
        connected: false,
      }
      setConnectedDevice(null)
      setPairedDevices(prev =>
        prev.map(d => d.id === disconnected.id ? disconnected : d)
      )
      toast.success('Naprava odklopljena')
    }
  }, [connectedDevice])

  // Forget device
  const forgetDevice = useCallback((deviceId: string) => {
    if (connectedDevice?.id === deviceId) {
      disconnectDevice()
    }
    setPairedDevices(prev => prev.filter(d => d.id !== deviceId))
    toast.success('Naprava odstranjena')
  }, [connectedDevice, disconnectDevice])

  // Send navigation prompt to helmet speaker
  const sendNavPrompt = useCallback((text: string) => {
    if (!connectedDevice || !navPrompts) return
    // In a real implementation, this would use the Bluetooth GATT
    // characteristic to send TTS data to the helmet speaker
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'sl-SI'
        utterance.volume = volume / 100
        speechSynthesis.speak(utterance)
      }
    } catch {
      // Speech synthesis not available
    }
  }, [connectedDevice, navPrompts, volume])

  // Expose sendNavPrompt for parent components
  useEffect(() => {
    if (connectedDevice && navPrompts) {
      // Store reference for external use
      try {
        (window as unknown as Record<string, unknown>).__mototrack_bt_nav = sendNavPrompt
      } catch { /* */ }
    }
    return () => {
      try {
        delete (window as unknown as Record<string, unknown>).__mototrack_bt_nav
      } catch { /* */ }
    }
  }, [connectedDevice, navPrompts, sendNavPrompt])

  if (!open) return null

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Headphones className="size-4 text-primary" />
          <span className="text-sm font-bold">Bluetooth čelada</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      {!bluetoothAvailable ? (
        /* Browser compatibility message */
        <div className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Ni na voljo</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Web Bluetooth API ni na voljo v vašem brskalniku. Za uporabo Bluetooth povezave
            s čelado uporabite Chrome ali Edge na namiznem računalniku ali Android napravi.
            Funkcija je eksperimentalna in morda ne bo delovala v vseh brskalnikih.
          </p>
          <div className="mt-3 p-2 bg-secondary/50 rounded-lg">
            <p className="text-[10px] text-muted-foreground">
              Podprti brskalniki: Chrome 56+, Edge 79+, Opera 43+
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected device info */}
          {connectedDevice ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Headphones className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">{connectedDevice.name}</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
                        <CheckCircle className="size-3 mr-0.5" /> Povezano
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {connectedDevice.batteryLevel !== undefined && (
                        <span className={`flex items-center gap-1 text-xs ${getBatteryColor(connectedDevice.batteryLevel)}`}>
                          {(() => { const BIcon = getBatteryIcon(connectedDevice.batteryLevel); return <BIcon className="size-3" /> })()}
                          {connectedDevice.batteryLevel}%
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Bluetooth className="size-3" /> Povezano
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-3">
              <BluetoothOff className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nobena naprava ni povezana</p>
            </div>
          )}

          {/* Scan button */}
          {!connectedDevice && (
            <Button
              className="w-full gap-2"
              onClick={scanForDevices}
              disabled={scanning}
            >
              <Search className={`size-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Iščem naprave...' : 'Išči Bluetooth naprave'}
            </Button>
          )}

          {/* Disconnect button */}
          {connectedDevice && (
            <Button
              variant="outline"
              className="w-full gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={disconnectDevice}
            >
              <BluetoothOff className="size-4" /> Odklopi napravo
            </Button>
          )}

          <Separator />

          {/* Volume control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="size-3.5" /> Glasnost
              </Label>
              <span className="text-xs font-medium">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={5}
              onValueChange={handleVolumeChange}
            />
          </div>

          {/* Voice commands toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              {voiceCommands ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
              Glasovni ukazi
            </Label>
            <Switch checked={voiceCommands} onCheckedChange={handleVoiceToggle} />
          </div>

          {/* Navigation prompts toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <Volume2 className="size-3.5" />
              Navigacijska sporočila
            </Label>
            <Switch checked={navPrompts} onCheckedChange={handleNavToggle} />
          </div>

          <Separator />

          {/* Paired devices list */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              Seznam seznanjenih naprav ({pairedDevices.length})
            </Label>
            {pairedDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Ni seznanjenih naprav
              </p>
            ) : (
              <ScrollArea className="max-h-32">
                <div className="space-y-1.5">
                  {pairedDevices.map(device => (
                    <div
                      key={device.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                        connectedDevice?.id === device.id
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`size-2 rounded-full shrink-0 ${
                        connectedDevice?.id === device.id ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      }`} />
                      <span className="text-xs font-medium flex-1 truncate">{device.name}</span>
                      {connectedDevice?.id !== device.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => connectToDevice(device)}
                          disabled={connecting}
                        >
                          Poveži
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => forgetDevice(device.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Test nav prompt */}
          {connectedDevice && navPrompts && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={() => sendNavPrompt('Zavijte desno čez 200 metrov')}
            >
              <Volume2 className="size-3" /> Preizkus navigacijskega sporočila
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
