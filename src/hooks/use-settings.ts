'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { create } from 'zustand'

export type UnitSystem = 'metric' | 'imperial'

export interface AppSettings {
  unitSystem: UnitSystem
  autoPauseEnabled: boolean
  autoPauseSpeedThreshold: number
  hideStartEnd: boolean
  wakelockEnabled: boolean
  avoidTolls: boolean
  speedLimit: number
  speedAlertEnabled: boolean
  speedAlertSound: boolean
}

export interface PrivacyZone {
  id: string
  name: string
  lat: number
  lng: number
  radiusMeters: number
}

const defaultSettings: AppSettings = {
  unitSystem: 'metric',
  autoPauseEnabled: true,
  autoPauseSpeedThreshold: 5.0,
  hideStartEnd: false,
  wakelockEnabled: true,
  avoidTolls: false,
  speedLimit: 90,
  speedAlertEnabled: true,
  speedAlertSound: true,
}

// Zustand store for settings - shared across all components
interface SettingsStore {
  settings: AppSettings
  privacyZones: PrivacyZone[]
  loaded: boolean
  setSettings: (settings: Partial<AppSettings>) => void
  setPrivacyZones: (zones: PrivacyZone[]) => void
  addPrivacyZone: (zone: PrivacyZone) => void
  removePrivacyZone: (id: string) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  privacyZones: [],
  loaded: false,
  setSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
  setPrivacyZones: (zones) => set({ privacyZones: zones }),
  addPrivacyZone: (zone) => set((state) => ({ privacyZones: [...state.privacyZones, zone] })),
  removePrivacyZone: (id) => set((state) => ({ privacyZones: state.privacyZones.filter(z => z.id !== id) })),
  reset: () => set({ settings: defaultSettings, privacyZones: [], loaded: false }),
}))

// Unit conversion utilities
export function kmToMiles(km: number): number {
  return km * 0.621371
}

export function milesToKm(miles: number): number {
  return miles * 1.60934
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371
}

export function metersToFeet(meters: number): number {
  return meters * 3.28084
}

// Format distance based on unit system
export function formatDistance(km: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const miles = kmToMiles(km)
    return `${miles.toFixed(1)} mi`
  }
  return `${km.toFixed(1)} km`
}

// Format speed based on unit system
export function formatSpeed(kmh: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const mph = kmhToMph(kmh)
    return `${mph.toFixed(0)} mph`
  }
  return `${kmh.toFixed(0)} km/h`
}

// Format elevation based on unit system
export function formatElevation(meters: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const feet = metersToFeet(meters)
    return `${feet.toFixed(0)} ft`
  }
  return `${meters.toFixed(0)} m`
}

// Get distance unit label
export function distanceUnit(unitSystem: UnitSystem = 'metric'): string {
  return unitSystem === 'imperial' ? 'mi' : 'km'
}

// Get speed unit label
export function speedUnit(unitSystem: UnitSystem = 'metric'): string {
  return unitSystem === 'imperial' ? 'mph' : 'km/h'
}

// Get elevation unit label
export function elevationUnit(unitSystem: UnitSystem = 'metric'): string {
  return unitSystem === 'imperial' ? 'ft' : 'm'
}

// Convert a speed value for display (returns the number in the user's preferred unit)
export function convertSpeed(kmh: number, unitSystem: UnitSystem = 'metric'): number {
  if (unitSystem === 'imperial') return kmhToMph(kmh)
  return kmh
}

// Convert a distance value for display
export function convertDistance(km: number, unitSystem: UnitSystem = 'metric'): number {
  if (unitSystem === 'imperial') return kmToMiles(km)
  return km
}

// Convert an elevation value for display
export function convertElevation(meters: number, unitSystem: UnitSystem = 'metric'): number {
  if (unitSystem === 'imperial') return metersToFeet(meters)
  return meters
}

// Check if a point is within any privacy zone
export function isInPrivacyZone(lat: number, lng: number, zones: PrivacyZone[]): boolean {
  for (const zone of zones) {
    const R = 6371000 // Earth radius in meters
    const dLat = ((lat - zone.lat) * Math.PI) / 180
    const dLng = ((lng - zone.lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((zone.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (distance <= zone.radiusMeters) return true
  }
  return false
}

// Obfuscate a coordinate near a privacy zone (move to zone edge)
export function obfuscateCoordinate(
  lat: number,
  lng: number,
  zones: PrivacyZone[]
): { lat: number; lng: number } | null {
  for (const zone of zones) {
    const R = 6371000
    const dLat = ((lat - zone.lat) * Math.PI) / 180
    const dLng = ((lng - zone.lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((zone.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    if (distance <= zone.radiusMeters) {
      // Move point to the edge of the zone in the same direction
      if (distance === 0) {
        // Point is exactly at center - move it north
        const edgeLat = zone.lat + (zone.radiusMeters / R) * (180 / Math.PI)
        return { lat: edgeLat, lng: zone.lng }
      }
      const ratio = zone.radiusMeters / distance
      const edgeLat = zone.lat + (lat - zone.lat) * ratio
      const edgeLng = zone.lng + (lng - zone.lng) * ratio
      return { lat: edgeLat, lng: edgeLng }
    }
  }
  return null
}

// Hook to fetch and manage settings from the server
export function useFetchSettings(userId?: string) {
  const { setSettings, setPrivacyZones, loaded } = useSettingsStore()
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!userId || fetchedRef.current) return
    fetchedRef.current = true

    // Fetch settings
    fetch(`/api/settings?userId=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) setSettings(j.data)
      })
      .catch(() => {})

    // Fetch privacy zones
    fetch(`/api/privacy-zones?userId=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) setPrivacyZones(j.data)
      })
      .catch(() => {})
  }, [userId, setSettings, setPrivacyZones, loaded])
}

// Save settings to server
export async function saveSettings(userId: string, settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...settings }),
    })
    return res.ok
  } catch {
    return false
  }
}

// WakeLock hook
export function useWakeLock(enabled: boolean, isTracking: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const requestWakeLock = useCallback(async () => {
    if (!enabled || !isTracking) return
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {
      // WakeLock not supported or denied
    }
  }, [enabled, isTracking])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        // ignore
      }
      wakeLockRef.current = null
    }
  }, [])

  useEffect(() => {
    if (enabled && isTracking) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }
    return () => { releaseWakeLock() }
  }, [enabled, isTracking, requestWakeLock, releaseWakeLock])

  // Re-request on visibility change (e.g. when user comes back to the page)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && enabled && isTracking && !wakeLockRef.current) {
        await requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, isTracking, requestWakeLock])
}
