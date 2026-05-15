'use client'

/**
 * MapLibre GL Custom Protocol Handler for Offline Tile Caching
 * 
 * This module provides a custom protocol handler that intercepts MapLibre GL
 * tile requests and serves cached tiles from IndexedDB when available.
 * Falls back to network when no cached tile is found, and caches new tiles.
 */

const DB_NAME = 'mototrack-offline-maps'
const STORE_NAME = 'tiles'
const DB_VERSION = 1

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveTile(key: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, blob, timestamp: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getTile(key: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result?.blob ?? null)
    request.onerror = () => reject(request.error)
  })
}

export async function getTileWithTimestamp(key: string): Promise<{ blob: Blob; timestamp: number } | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => {
      const result = request.result
      if (result?.blob) {
        resolve({ blob: result.blob, timestamp: result.timestamp || 0 })
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function deleteAllTiles(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteTilesByPrefix(prefix: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        if (cursor.value.key.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getStorageEstimate(): Promise<{ usedBytes: number; tileCount: number }> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const items = request.result || []
      let usedBytes = 0
      items.forEach((item: any) => {
        usedBytes += item.blob?.size || 0
      })
      resolve({ usedBytes, tileCount: items.length })
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getTileCountByPrefix(prefix: string): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const items = request.result || []
      const count = items.filter((item: any) => item.key.startsWith(prefix)).length
      resolve(count)
    }
    request.onerror = () => reject(request.error)
  })
}

// ─── Tile Expiry ──────────────────────────────────────────────────────────────

const TILE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function isTileExpired(timestamp: number): boolean {
  return Date.now() - timestamp > TILE_EXPIRY_MS
}

// ─── Storage Check ────────────────────────────────────────────────────────────

export async function checkLowStorage(): Promise<boolean> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      const remaining = (estimate.quota ?? 0) - (estimate.usage ?? 0)
      return remaining < 100 * 1024 * 1024 // < 100MB remaining
    } catch {
      return false
    }
  }
  return false
}

// ─── MapLibre GL Custom Protocol ─────────────────────────────────────────────

let protocolRegistered = false

/**
 * Register a custom protocol with MapLibre GL that intercepts tile requests
 * and serves cached tiles from IndexedDB.
 * 
 * Usage:
 *   registerOfflineProtocol()
 *   // Then use "offline://" prefix in your tile URLs:
 *   // tiles: ['offline://osm/{z}/{x}/{y}']
 * 
 * The protocol maps URLs like:
 *   offline://osm/{z}/{x}/{y} → https://tile.openstreetmap.org/{z}/{x}/{y}.png
 *   offline://terrain/{z}/{x}/{y} → https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 */
export async function registerOfflineProtocol(): Promise<void> {
  if (protocolRegistered) return
  if (typeof window === 'undefined') return

  try {
    const maplibregl = (await import('maplibre-gl')).default

    // Define the tile source mapping
    const tileSourceMap: Record<string, string[]> = {
      'osm': [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      'terrain': [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      ],
      'cartodb-dark': [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      'esri-satellite': [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
    }

    maplibregl.addProtocol('offline', async (params: any, callback: any) => {
      try {
        // Parse the URL: offline://osm/12/2145/1432
        const url = new URL(params.url.replace('offline://', 'https://'))
        const source = url.hostname // e.g., 'osm'
        const pathParts = url.pathname.split('/').filter(Boolean) // e.g., ['12', '2145', '1432']
        
        if (pathParts.length < 3) {
          throw new Error(`Invalid offline tile URL: ${params.url}`)
        }

        const z = pathParts[0]
        const x = pathParts[1]
        const y = pathParts[2]

        // Cache key format: tile_{source}_{z}_{x}_{y}
        const cacheKey = `tile_${source}_${z}_${x}_${y}`

        // Check IndexedDB for cached tile
        const cached = await getTileWithTimestamp(cacheKey)
        if (cached) {
          // If tile is expired, we'll still serve it but queue a refresh
          if (isTileExpired(cached.timestamp)) {
            // Refresh in background - don't block the current request
            refreshTileInBackground(source, z, x, y, tileSourceMap, cacheKey)
          }
          
          // Convert blob to ArrayBuffer for MapLibre
          const arrayBuffer = await cached.blob.arrayBuffer()
          callback(null, arrayBuffer, null, null)
          return
        }

        // Not in cache, fetch from network
        const sourceUrls = tileSourceMap[source]
        if (!sourceUrls || sourceUrls.length === 0) {
          throw new Error(`Unknown tile source: ${source}`)
        }

        // Pick a random server from the list for load balancing
        const templateUrl = sourceUrls[Math.floor(Math.random() * sourceUrls.length)]
        const realUrl = templateUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y)

        const response = await fetch(realUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const blob = await response.blob()
        
        // Cache the tile for offline use (non-blocking)
        saveTile(cacheKey, blob).catch(() => {
          // Ignore cache write errors
        })

        const arrayBuffer = await blob.arrayBuffer()
        callback(null, arrayBuffer, null, null)
      } catch (err: any) {
        callback(new Error(err.message || 'Offline protocol error'), null, null, null)
      }
    })

    protocolRegistered = true
  } catch (err) {
    console.error('Failed to register offline protocol:', err)
  }
}

/**
 * Refresh a tile in the background without blocking the current request
 */
async function refreshTileInBackground(
  source: string,
  z: string,
  x: string,
  y: string,
  tileSourceMap: Record<string, string[]>,
  cacheKey: string,
): Promise<void> {
  try {
    const sourceUrls = tileSourceMap[source]
    if (!sourceUrls || sourceUrls.length === 0) return

    const templateUrl = sourceUrls[Math.floor(Math.random() * sourceUrls.length)]
    const realUrl = templateUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y)

    const response = await fetch(realUrl)
    if (response.ok) {
      const blob = await response.blob()
      await saveTile(cacheKey, blob)
    }
  } catch {
    // Silently ignore refresh errors
  }
}

/**
 * Get the offline tile URL template for a given source
 */
export function getOfflineTileUrl(source: string): string {
  return `offline://${source}/{z}/{x}/{y}`
}

/**
 * Get tile URLs that use the offline protocol
 */
export function getOfflineTileUrls(source: string): string[] {
  return [getOfflineTileUrl(source)]
}

/**
 * Check if the offline protocol has been registered
 */
export function isOfflineProtocolRegistered(): boolean {
  return protocolRegistered
}
