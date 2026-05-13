'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Cpu,
  Bluetooth,
  Gauge,
  Thermometer,
  Fuel,
  Activity,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react'

interface OBDReading {
  label: string
  value: string
  unit: string
  status: 'normal' | 'warning' | 'critical'
  icon: React.ReactNode
}

interface OBDSensor {
  id: string
  name: string
  connected: boolean
  batteryLevel: number
  lastReading: string
}

const DEMO_SENSORS: OBDSensor[] = [
  { id: 'obd2-dongle', name: 'OBD2 Dongle', connected: false, batteryLevel: 85, lastReading: '-' },
  { id: 'tire-pressure', name: 'Tlak pnevmatik', connected: false, batteryLevel: 62, lastReading: '-' },
  { id: 'temperator', name: 'Temperaturni senzor', connected: false, batteryLevel: 91, lastReading: '-' },
]

export default function OBDPanel({ userId }: { userId?: string }) {
  const [sensors, setSensors] = useState<OBDSensor[]>(DEMO_SENSORS)
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [readings, setReadings] = useState<OBDReading[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)

  const updateReadings = useCallback(() => {
    const rpm = Math.floor(3000 + Math.random() * 5000)
    const temp = Math.floor(75 + Math.random() * 30)
    const fuelRate = (4.5 + Math.random() * 3).toFixed(1)
    const speed = Math.floor(40 + Math.random() * 120)
    const battery = (12.2 + Math.random() * 1.5).toFixed(1)
    const throttle = Math.floor(Math.random() * 100)

    setReadings([
      { label: 'Vrtljaji', value: rpm.toString(), unit: 'RPM', status: rpm > 7000 ? 'warning' : 'normal', icon: <Gauge className="size-4" /> },
      { label: 'Temperatura', value: temp.toString(), unit: '°C', status: temp > 100 ? 'critical' : temp > 90 ? 'warning' : 'normal', icon: <Thermometer className="size-4" /> },
      { label: 'Poraba', value: fuelRate, unit: 'L/h', status: parseFloat(fuelRate) > 6 ? 'warning' : 'normal', icon: <Fuel className="size-4" /> },
      { label: 'Hitrost', value: speed.toString(), unit: 'km/h', status: 'normal', icon: <Activity className="size-4" /> },
      { label: 'Baterija', value: battery, unit: 'V', status: parseFloat(battery) < 12.0 ? 'critical' : 'normal', icon: <Zap className="size-4" /> },
      { label: 'Plin', value: throttle.toString(), unit: '%', status: 'normal', icon: <Gauge className="size-4" /> },
    ])
  }, [])

  const connectSensor = useCallback((sensorId: string) => {
    setIsConnecting(sensorId)
    // Simulate connection delay
    setTimeout(() => {
      setSensors(prev =>
        prev.map(s =>
          s.id === sensorId ? { ...s, connected: true, lastReading: new Date().toLocaleTimeString('sl-SI') } : s
        )
      )
      setIsConnecting(null)
      // Generate demo readings
      updateReadings()
    }, 1500)
  }, [updateReadings])

  const disconnectSensor = useCallback((sensorId: string) => {
    setSensors(prev =>
      prev.map(s =>
        s.id === sensorId ? { ...s, connected: false, lastReading: '-' } : s
      )
    )
  }, [])

  const startSimulation = useCallback(() => {
    setIsSimulating(true)
    // Connect all sensors
    setSensors(prev => prev.map(s => ({ ...s, connected: true, lastReading: new Date().toLocaleTimeString('sl-SI') })))
    updateReadings()
  }, [updateReadings])

  const stopSimulation = useCallback(() => {
    setIsSimulating(false)
    setSensors(prev => prev.map(s => ({ ...s, connected: false, lastReading: '-' })))
    setReadings([])
  }, [])

  const connectedCount = sensors.filter(s => s.connected).length
  const statusColors: Record<string, string> = {
    normal: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
  }
  const statusBg: Record<string, string> = {
    normal: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    critical: 'bg-red-500/10',
  }

  return (
    <Card className="border-cyan-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="size-5 text-cyan-500" />
          Povezava z motociklom (OBD/IoT)
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${connectedCount > 0 ? 'border-cyan-300 text-cyan-500' : 'border-muted text-muted-foreground'}`}>
            {connectedCount > 0 ? `${connectedCount} povezanih` : 'Nepovezano'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Demo mode toggle */}
        <div className="flex items-center justify-between rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3">
          <div className="flex items-center gap-2">
            <Bluetooth className="size-4 text-cyan-500" />
            <span className="text-sm font-medium">Demo način</span>
          </div>
          <Switch
            checked={isSimulating}
            onCheckedChange={(checked) => checked ? startSimulation() : stopSimulation()}
          />
        </div>

        {/* Sensor list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Senzorji</p>
          {sensors.map(sensor => (
            <div
              key={sensor.id}
              className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                sensor.connected ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`size-2.5 rounded-full flex-shrink-0 ${sensor.connected ? 'bg-cyan-500 animate-pulse' : 'bg-muted'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sensor.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {sensor.connected ? `Zadnje branje: ${sensor.lastReading}` : 'Ni povezano'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sensor.connected && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    🔋 {sensor.batteryLevel}%
                  </Badge>
                )}
                <Button
                  variant={sensor.connected ? 'outline' : 'default'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => sensor.connected ? disconnectSensor(sensor.id) : connectSensor(sensor.id)}
                  disabled={isConnecting === sensor.id}
                >
                  {isConnecting === sensor.id ? (
                    <RefreshCw className="size-3 animate-spin" />
                  ) : sensor.connected ? (
                    'Prekini'
                  ) : (
                    <><Bluetooth className="size-3" /> Poveži</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* OBD Readings */}
        {readings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Meritve v živo</p>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={updateReadings}>
                <RefreshCw className="size-3" /> Osveži
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {readings.map((reading, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg p-2.5 ${statusBg[reading.status]}`}
                >
                  <div className={statusColors[reading.status]}>
                    {reading.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">{reading.label}</p>
                    <p className={`text-sm font-bold ${statusColors[reading.status]}`}>
                      {reading.value} <span className="text-[10px] font-normal text-muted-foreground">{reading.unit}</span>
                    </p>
                  </div>
                  {reading.status !== 'normal' && (
                    <AlertTriangle className={`size-3.5 ${statusColors[reading.status]}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No readings state */}
        {readings.length === 0 && !isSimulating && (
          <div className="text-center py-6">
            <Cpu className="size-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Povežite OBD2 napravo za meritve v živo</p>
            <p className="text-xs text-muted-foreground mt-1">Podpira Bluetooth OBD2 dongle, tire pressure senzorje in temperaturne senzorje</p>
          </div>
        )}

        {/* Refresh rate */}
        {isSimulating && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Osveževanje: {autoRefresh ? '5s' : 'Ročno'}</span>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-75" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
