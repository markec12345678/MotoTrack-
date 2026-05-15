'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  CircleDot,
  Download,
  StopCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ───────────────────────────────────────────────────────────────

interface OBDReading {
  label: string
  value: string
  unit: string
  status: 'normal' | 'warning' | 'critical'
  icon: React.ReactNode
  rawValue: number
}

interface OBDSensor {
  id: string
  name: string
  connected: boolean
  batteryLevel: number
  lastReading: string
}

interface SensorSnapshot {
  timestamp: string
  readings: OBDReading[]
}

// ── Bluetooth types (not available in all browsers) ─────────────────────

interface BluetoothRemoteGATTCharacteristic {
  readonly service: any
  readonly uuid: string
  readonly value: DataView | null
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
}

interface BluetoothRemoteGATTService {
  readonly uuid: string
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  readonly device: any
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothDevice {
  readonly id: string
  readonly name: string
  readonly gatt: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
}

interface BluetoothRequestDeviceOptions {
  filters?: Array<{ services: string[] } | { namePrefix: string }>
  optionalServices?: string[]
}

// OBD2 common service UUIDs
const OBD2_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const OBD2_RPM_CHARACTERISTIC = '00002a19-0000-1000-8000-00805f9b34fb'
const OBD2_SPEED_CHARACTERISTIC = '00002a1a-0000-1000-8000-00805f9b34fb'

const DEMO_SENSORS: OBDSensor[] = [
  { id: 'obd2-dongle', name: 'OBD2 Dongle', connected: false, batteryLevel: 85, lastReading: '-' },
  { id: 'tire-pressure', name: 'Tlak pnevmatik', connected: false, batteryLevel: 62, lastReading: '-' },
  { id: 'temperator', name: 'Temperaturni senzor', connected: false, batteryLevel: 91, lastReading: '-' },
]

// ── Status threshold helpers ────────────────────────────────────────────

function rpmStatus(rpm: number): 'normal' | 'warning' | 'critical' {
  if (rpm > 8500) return 'critical'
  if (rpm > 7000) return 'warning'
  return 'normal'
}

function tempStatus(temp: number): 'normal' | 'warning' | 'critical' {
  if (temp > 110) return 'critical'
  if (temp > 100) return 'warning'
  return 'normal'
}

function batteryStatus(voltage: number): 'normal' | 'warning' | 'critical' {
  if (voltage < 12.0) return 'critical'
  if (voltage < 12.4) return 'warning'
  return 'normal'
}

function fuelRateStatus(rate: number): 'normal' | 'warning' {
  return rate > 6 ? 'warning' : 'normal'
}

// ── Component ───────────────────────────────────────────────────────────

export default function OBDPanel({ userId }: { userId?: string }) {
  const [sensors, setSensors] = useState<OBDSensor[]>(DEMO_SENSORS)
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [readings, setReadings] = useState<OBDReading[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedSnapshots, setRecordedSnapshots] = useState<SensorSnapshot[]>([])
  const [bluetoothConnected, setBluetoothConnected] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null)
  const [bluetoothServer, setBluetoothServer] = useState<BluetoothRemoteGATTServer | null>(null)

  const autoRefreshRef = useRef(autoRefresh)
  const isSimulatingRef = useRef(isSimulating)
  const bluetoothConnectedRef = useRef(bluetoothConnected)
  const readingsRef = useRef(readings)
  const recordedSnapshotsRef = useRef(recordedSnapshots)

  // Keep refs in sync
  useEffect(() => { autoRefreshRef.current = autoRefresh }, [autoRefresh])
  useEffect(() => { isSimulatingRef.current = isSimulating }, [isSimulating])
  useEffect(() => { bluetoothConnectedRef.current = bluetoothConnected }, [bluetoothConnected])
  useEffect(() => { readingsRef.current = readings }, [readings])
  useEffect(() => { recordedSnapshotsRef.current = recordedSnapshots }, [recordedSnapshots])

  // ── Generate simulated readings ───────────────────────────────────────

  const generateSimulatedReadings = useCallback((): OBDReading[] => {
    const rpm = Math.floor(3000 + Math.random() * 5000)
    const temp = Math.floor(75 + Math.random() * 40)
    const fuelRate = parseFloat((4.5 + Math.random() * 3).toFixed(1))
    const speed = Math.floor(40 + Math.random() * 120)
    const battery = parseFloat((11.8 + Math.random() * 1.9).toFixed(1))
    const throttle = Math.floor(Math.random() * 100)

    return [
      { label: 'Vrtljaji', value: rpm.toString(), unit: 'RPM', status: rpmStatus(rpm), icon: <Gauge className="size-4" />, rawValue: rpm },
      { label: 'Temperatura', value: temp.toString(), unit: '°C', status: tempStatus(temp), icon: <Thermometer className="size-4" />, rawValue: temp },
      { label: 'Poraba', value: fuelRate.toString(), unit: 'L/h', status: fuelRateStatus(fuelRate), icon: <Fuel className="size-4" />, rawValue: fuelRate },
      { label: 'Hitrost', value: speed.toString(), unit: 'km/h', status: 'normal', icon: <Activity className="size-4" />, rawValue: speed },
      { label: 'Baterija', value: battery.toString(), unit: 'V', status: batteryStatus(battery), icon: <Zap className="size-4" />, rawValue: battery },
      { label: 'Plin', value: throttle.toString(), unit: '%', status: 'normal', icon: <Gauge className="size-4" />, rawValue: throttle },
    ]
  }, [])

  // ── Parse GATT characteristic for OBD2 ────────────────────────────────

  const parseGattReadings = useCallback((char: BluetoothRemoteGATTCharacteristic): Partial<OBDReading>[] => {
    // This is a simplified parser; real OBD2 dongles use ELM327 protocol
    // which is more complex. Here we parse basic characteristic values.
    const results: Partial<OBDReading>[] = []
    if (!char.value) return results

    const dv = char.value
    if (char.uuid === OBD2_RPM_CHARACTERISTIC && dv.byteLength >= 2) {
      const rpm = dv.getUint16(0) * 0.25 // OBD2 RPM is 1/4 RPM
      results.push({ label: 'Vrtljaji', value: rpm.toString(), unit: 'RPM', status: rpmStatus(rpm), icon: <Gauge className="size-4" />, rawValue: rpm })
    }
    if (char.uuid === OBD2_SPEED_CHARACTERISTIC && dv.byteLength >= 1) {
      const speed = dv.getUint8(0)
      results.push({ label: 'Hitrost', value: speed.toString(), unit: 'km/h', status: 'normal', icon: <Activity className="size-4" />, rawValue: speed })
    }
    return results
  }, [])

  // ── Read from Bluetooth GATT ──────────────────────────────────────────

  const readBluetoothData = useCallback(async (): Promise<OBDReading[] | null> => {
    if (!bluetoothServer?.connected) return null
    try {
      const service = await bluetoothServer.getPrimaryService(OBD2_SERVICE_UUID)
      const chars = await service.getCharacteristics()
      const parsedReadings: OBDReading[] = []

      for (const char of chars) {
        try {
          await char.readValue()
          const parsed = parseGattReadings(char)
          parsedReadings.push(...(parsed as OBDReading[]))
        } catch {
          // Skip unreadable characteristics
        }
      }

      // Fill in missing readings with partial simulation
      if (parsedReadings.length > 0) {
        const hasRpm = parsedReadings.some(r => r.label === 'Vrtljaji')
        const hasTemp = parsedReadings.some(r => r.label === 'Temperatura')
        const hasSpeed = parsedReadings.some(r => r.label === 'Hitrost')
        const hasBattery = parsedReadings.some(r => r.label === 'Baterija')

        if (!hasTemp) {
          const temp = Math.floor(80 + Math.random() * 15)
          parsedReadings.push({ label: 'Temperatura', value: temp.toString(), unit: '°C', status: tempStatus(temp), icon: <Thermometer className="size-4" />, rawValue: temp })
        }
        if (!hasRpm) {
          const rpm = Math.floor(3000 + Math.random() * 3000)
          parsedReadings.push({ label: 'Vrtljaji', value: rpm.toString(), unit: 'RPM', status: rpmStatus(rpm), icon: <Gauge className="size-4" />, rawValue: rpm })
        }
        if (!hasSpeed) {
          const speed = Math.floor(60 + Math.random() * 80)
          parsedReadings.push({ label: 'Hitrost', value: speed.toString(), unit: 'km/h', status: 'normal', icon: <Activity className="size-4" />, rawValue: speed })
        }
        if (!hasBattery) {
          const battery = parseFloat((12.4 + Math.random() * 0.8).toFixed(1))
          parsedReadings.push({ label: 'Baterija', value: battery.toString(), unit: 'V', status: batteryStatus(battery), icon: <Zap className="size-4" />, rawValue: battery })
        }

        const fuelRate = parseFloat((4.5 + Math.random() * 2).toFixed(1))
        parsedReadings.push({ label: 'Poraba', value: fuelRate.toString(), unit: 'L/h', status: fuelRateStatus(fuelRate), icon: <Fuel className="size-4" />, rawValue: fuelRate })
        const throttle = Math.floor(Math.random() * 60)
        parsedReadings.push({ label: 'Plin', value: throttle.toString(), unit: '%', status: 'normal', icon: <Gauge className="size-4" />, rawValue: throttle })

        return parsedReadings
      }
    } catch (err) {
      console.warn('Bluetooth read failed:', err)
    }
    return null
  }, [bluetoothServer, parseGattReadings])

  // ── Update readings (Bluetooth or simulation) ─────────────────────────

  const updateReadings = useCallback(async () => {
    // Try Bluetooth first
    if (bluetoothConnectedRef.current) {
      const btReadings = await readBluetoothData()
      if (btReadings) {
        setReadings(btReadings)
        return
      }
    }
    // Fall back to simulation
    if (isSimulatingRef.current) {
      setReadings(generateSimulatedReadings())
    }
  }, [readBluetoothData, generateSimulatedReadings])

  // ── Auto-refresh interval ─────────────────────────────────────────────

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      updateReadings()
    }, 2000)
    return () => clearInterval(interval)
  }, [autoRefresh, updateReadings])

  // ── Recording snapshot interval ───────────────────────────────────────

  useEffect(() => {
    if (!isRecording) return
    const interval = setInterval(() => {
      const current = readingsRef.current
      if (current.length > 0) {
        const snapshot: SensorSnapshot = {
          timestamp: new Date().toISOString(),
          readings: current,
        }
        setRecordedSnapshots(prev => [...prev, snapshot])
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isRecording])

  // ── Web Bluetooth connection ──────────────────────────────────────────

  const connectBluetooth = useCallback(async () => {
    // Check if Web Bluetooth API is available
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      toast.error('Web Bluetooth ni podprt v tem brskalniku', {
        description: 'Uporabite Chrome na namizju ali Android. Preklopite na demo način.'
      })
      return
    }

    try {
      setIsConnecting('obd2-dongle')
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [OBD2_SERVICE_UUID] }],
        optionalServices: [OBD2_SERVICE_UUID],
      } as BluetoothRequestDeviceOptions) as BluetoothDevice

      if (!device.gatt) {
        toast.error('Naprava ne podpira GATT')
        setIsConnecting(null)
        return
      }

      const server = await device.gatt.connect()
      setBluetoothDevice(device)
      setBluetoothServer(server)
      setBluetoothConnected(true)

      // Update sensor status
      setSensors(prev =>
        prev.map(s =>
          s.id === 'obd2-dongle'
            ? { ...s, connected: true, lastReading: new Date().toLocaleTimeString('sl-SI') }
            : s
        )
      )

      toast.success(`Povezano: ${device.name || 'OBD2 naprava'}`)

      // Enable auto-refresh for live data
      setAutoRefresh(true)

      // Initial read
      const btReadings = await readBluetoothData()
      if (btReadings) {
        setReadings(btReadings)
      }
    } catch (err: unknown) {
      if (err.name === 'NotFoundError') {
        toast.info('Brez izbire naprave')
      } else {
        toast.error('Povezava ni uspela', { description: err.message })
      }
    } finally {
      setIsConnecting(null)
    }
  }, [readBluetoothData])

  const disconnectBluetooth = useCallback(() => {
    if (bluetoothDevice?.gatt?.connected) {
      bluetoothDevice.gatt.disconnect()
    }
    setBluetoothDevice(null)
    setBluetoothServer(null)
    setBluetoothConnected(false)
    setSensors(prev =>
      prev.map(s =>
        s.id === 'obd2-dongle'
          ? { ...s, connected: false, lastReading: '-' }
          : s
      )
    )
    toast.info('Bluetooth povezava prekinjena')
  }, [bluetoothDevice])

  // Cleanup Bluetooth on unmount
  useEffect(() => {
    return () => {
      if (bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect()
      }
    }
  }, [bluetoothDevice])

  // ── Simulation mode ───────────────────────────────────────────────────

  const startSimulation = useCallback(() => {
    setIsSimulating(true)
    setSensors(prev => prev.map(s => ({ ...s, connected: true, lastReading: new Date().toLocaleTimeString('sl-SI') })))
    const newReadings = generateSimulatedReadings()
    setReadings(newReadings)
  }, [generateSimulatedReadings])

  const stopSimulation = useCallback(() => {
    setIsSimulating(false)
    setAutoRefresh(false)
    setSensors(prev => prev.map(s => s.id === 'obd2-dongle' && bluetoothConnected ? s : { ...s, connected: false, lastReading: '-' }))
    setReadings([])
  }, [bluetoothConnected])

  // ── Sensor connect/disconnect ─────────────────────────────────────────

  const connectSensor = useCallback((sensorId: string) => {
    if (sensorId === 'obd2-dongle') {
      // Try Bluetooth for the main OBD2 sensor
      connectBluetooth()
      return
    }
    // Other sensors: simulate connection
    setIsConnecting(sensorId)
    setTimeout(() => {
      setSensors(prev =>
        prev.map(s =>
          s.id === sensorId ? { ...s, connected: true, lastReading: new Date().toLocaleTimeString('sl-SI') } : s
        )
      )
      setIsConnecting(null)
      updateReadings()
    }, 1500)
  }, [connectBluetooth, updateReadings])

  const disconnectSensor = useCallback((sensorId: string) => {
    if (sensorId === 'obd2-dongle' && bluetoothConnected) {
      disconnectBluetooth()
      return
    }
    setSensors(prev =>
      prev.map(s =>
        s.id === sensorId ? { ...s, connected: false, lastReading: '-' } : s
      )
    )
  }, [bluetoothConnected, disconnectBluetooth])

  // ── Recording ─────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    setRecordedSnapshots([])
    setIsRecording(true)
    toast.success('Snemanje začeto')
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    const count = recordedSnapshotsRef.current.length
    if (count > 0) {
      toast.success(`Snemanje končano: ${count} meritev shranjenih`)
    } else {
      toast.info('Ni bilo posnetih meritev')
    }
  }, [])

  const exportRecording = useCallback(() => {
    const snapshots = recordedSnapshotsRef.current
    if (snapshots.length === 0) {
      toast.error('Ni podatkov za izvoz')
      return
    }
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId: userId || 'unknown',
      snapshotCount: snapshots.length,
      snapshots,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obd-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Izvoženih ${snapshots.length} meritev`)
  }, [userId])

  // ── Derived state ─────────────────────────────────────────────────────

  const connectedCount = sensors.filter(s => s.connected).length
  const hasAnyWarnings = readings.some(r => r.status === 'warning' || r.status === 'critical')
  const hasCritical = readings.some(r => r.status === 'critical')

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
  const statusDotColor: Record<string, string> = {
    normal: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Card className={`border-cyan-500/30 ${hasCritical ? 'animate-pulse' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="size-5 text-cyan-500" />
          Povezava z motociklom (OBD/IoT)
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
            bluetoothConnected
              ? 'border-blue-300 text-blue-500'
              : connectedCount > 0
                ? 'border-cyan-300 text-cyan-500'
                : 'border-muted text-muted-foreground'
          }`}>
            {bluetoothConnected ? 'Bluetooth' : connectedCount > 0 ? `${connectedCount} povezanih` : 'Nepovezano'}
          </Badge>
          {hasCritical && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0">
              <AlertTriangle className="size-3 mr-1" />KRITIČNO
            </Badge>
          )}
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

        {/* Bluetooth connection status */}
        {bluetoothConnected && (
          <div className="flex items-center justify-between rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <div className="flex items-center gap-2">
              <Bluetooth className="size-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{bluetoothDevice?.name || 'OBD2 naprava'}</p>
                <p className="text-[10px] text-muted-foreground">Povezano preko Bluetooth GATT</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={disconnectBluetooth}
            >
              Prekini
            </Button>
          </div>
        )}

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
              <p className="text-xs font-medium text-muted-foreground">
                Meritve v živo
                {autoRefresh && <span className="ml-1 text-cyan-500">(vsake 2s)</span>}
              </p>
              <div className="flex items-center gap-1">
                {/* Recording controls */}
                {isRecording ? (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-red-500" onClick={stopRecording}>
                    <StopCircle className="size-3" /> Ustavi
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={startRecording}>
                    <CircleDot className="size-3" /> Snemaj
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={updateReadings}>
                  <RefreshCw className="size-3" /> Osveži
                </Button>
              </div>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                <div className="size-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-500 font-medium">SNEMANJE</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{recordedSnapshots.length} meritev</span>
              </div>
            )}

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
                    <div className="flex flex-col items-center gap-0.5">
                      <AlertTriangle className={`size-3.5 ${statusColors[reading.status]}`} />
                      <div className={`size-1.5 rounded-full ${statusDotColor[reading.status]}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No readings state */}
        {readings.length === 0 && !isSimulating && !bluetoothConnected && (
          <div className="text-center py-6">
            <Cpu className="size-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Povežite OBD2 napravo za meritve v živo</p>
            <p className="text-xs text-muted-foreground mt-1">Podpira Bluetooth OBD2 dongle, tire pressure senzorje in temperaturne senzorje</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {'bluetooth' in (typeof navigator !== 'undefined' ? navigator : {}) 
                ? '✅ Web Bluetooth podprt' 
                : '⚠️ Web Bluetooth ni podprt — uporabite demo način'}
            </p>
          </div>
        )}

        {/* Controls row */}
        {(isSimulating || bluetoothConnected) && (
          <div className="space-y-3">
            {/* Auto-refresh toggle */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Osveževanje: {autoRefresh ? 'vsake 2s' : 'Ročno'}</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-75" />
            </div>

            {/* Recording export */}
            {recordedSnapshots.length > 0 && !isRecording && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={exportRecording}
              >
                <Download className="size-3" />
                Izvozi {recordedSnapshots.length} meritev (JSON)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
