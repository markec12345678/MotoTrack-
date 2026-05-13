'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GpxImportResult } from '@/components/tabs/types'
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'

interface GpxManagerProps {
  userId?: string
  onImport?: (file: File) => Promise<GpxImportResult | null>
  onExport?: (routeId?: string) => void
  routeId?: string
  onRefresh?: () => void
}

export default function GpxManager({ userId, onImport, onExport, routeId, onRefresh }: GpxManagerProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importHistory, setImportHistory] = useState<GpxImportResult[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchHistory = useCallback(async () => {
    if (!userId) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/gpx?userId=${userId}`)
      if (res.ok) {
        const json = await res.json()
        setImportHistory(json.data || [])
      }
    } catch {
      /* ignore */
    }
    setLoadingHistory(false)
  }, [userId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast.error('Izberite GPX datoteko')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsImporting(true)
    try {
      if (onImport) {
        const result = await onImport(file)
        if (result) {
          setImportHistory(prev => [result, ...prev])
          toast.success(`Uvoženo: ${result.fileName}`)
        }
      } else {
        // Direct API import
        const formData = new FormData()
        formData.append('file', file)
        if (userId) formData.append('userId', userId)

        const res = await fetch('/api/gpx/import', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const json = await res.json()
          const imp = json.import as GpxImportResult | undefined
          if (imp) {
            setImportHistory(prev => [imp, ...prev])
          }
          toast.success(`GPX datoteka "${file.name}" uspešno uvožena`)
          onRefresh?.()
          // Refresh full history from server
          fetchHistory()
        } else {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error || 'Napaka pri uvozu GPX')
          // Refresh history (may include failed record)
          fetchHistory()
        }
      }
    } catch {
      toast.error('Napaka pri uvozu GPX datoteke')
      fetchHistory()
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      if (onExport) {
        await onExport(routeId)
      } else {
        // Direct API export
        const params = new URLSearchParams()
        if (routeId) {
          params.set('routeId', routeId)
        } else {
          toast.error('Izberite pot za izvoz')
          setIsExporting(false)
          return
        }

        const res = await fetch(`/api/gpx/export?${params}`)
        if (res.ok) {
          const blob = await res.blob()
          const contentDisposition = res.headers.get('Content-Disposition')
          let filename = 'export.gpx'
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="([^"]+)"/)
            if (match) filename = match[1]
          }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          toast.success('GPX datoteka izvožena')
        } else {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error || 'Napaka pri izvozu GPX')
        }
      }
    } catch {
      toast.error('Napaka pri izvozu GPX datoteke')
    } finally {
      setIsExporting(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card className="border-violet-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-violet-500" />
          GPX datoteke
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Import */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full gap-2 h-9"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isImporting ? 'Uvažam...' : 'Uvozi GPX'}
            </Button>
          </div>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || !routeId}
            className="w-full gap-2 h-9"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? 'Izvažam...' : 'Izvozi GPX'}
          </Button>
        </div>

        {/* Supported formats info */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-medium">Podprti formati</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">.gpx 1.0</Badge>
            <Badge variant="outline" className="text-[10px]">.gpx 1.1</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            GPX datoteke lahko vsebujejo poti, sledi in potekalne točke
          </p>
        </div>

        {/* Import progress */}
        {isImporting && (
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm">Uvažam GPX datoteko...</span>
          </div>
        )}

        {/* Import history */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5" />
              Zgodovina uvozov
            </span>
            {importHistory.length > 0 && (
              <Badge variant="outline" className="text-[10px]">{importHistory.length}</Badge>
            )}
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : importHistory.length > 0 ? (
            <ScrollArea className="max-h-40">
              <div className="space-y-1.5 pr-2">
                {importHistory.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-md border p-2 ${
                      item.status === 'error' || item.status === 'failed' ? 'border-rose-500/30 bg-rose-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {(item.status === 'success' || item.status === 'completed') ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{item.fileName}</p>
                        {(item.status === 'success' || item.status === 'completed') && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.routeCount} ruta · {item.trackCount} sledi
                            {item.fileSize ? ` · ${formatFileSize(item.fileSize)}` : ''}
                          </p>
                        )}
                        {(item.status === 'error' || item.status === 'failed') && (
                          <p className="text-[10px] text-rose-500">Napaka pri uvozu</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
                      onClick={() => setImportHistory(prev => prev.filter(i => i.id !== item.id))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Ni zgodovine uvozov</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
