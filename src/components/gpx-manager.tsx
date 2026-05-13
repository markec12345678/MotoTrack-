'use client'

import { useState, useRef } from 'react'
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

interface GpxManagerProps {
  onImport?: (file: File) => Promise<GpxImportResult | null>
  onExport?: (routeId?: string) => void
  routeId?: string
}

export default function GpxManager({ onImport, onExport, routeId }: GpxManagerProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importHistory, setImportHistory] = useState<GpxImportResult[]>([
    {
      id: 'gpx-1',
      fileName: 'alpska_ruta_2024.gpx',
      routeCount: 1,
      trackCount: 2,
      status: 'success',
    },
    {
      id: 'gpx-2',
      fileName: 'slovenija_tour.gpx',
      routeCount: 2,
      trackCount: 5,
      status: 'success',
    },
    {
      id: 'gpx-3',
      fileName: 'neveljavna_datoteka.gpx',
      routeCount: 0,
      trackCount: 0,
      status: 'error',
    },
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const result = await onImport?.(file) ?? {
        id: `gpx-${Date.now()}`,
        fileName: file.name,
        routeCount: 1,
        trackCount: 1,
        status: 'success',
      }
      setImportHistory(prev => [result, ...prev])
    } catch {
      setImportHistory(prev => [
        {
          id: `gpx-${Date.now()}`,
          fileName: file.name,
          routeCount: 0,
          trackCount: 0,
          status: 'error',
        },
        ...prev,
      ])
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExport?.(routeId)
    } finally {
      setIsExporting(false)
    }
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
            disabled={isExporting}
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
        {importHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                Zgodovina uvozov
              </span>
              <Badge variant="outline" className="text-[10px]">{importHistory.length}</Badge>
            </div>
            <ScrollArea className="max-h-40">
              <div className="space-y-1.5 pr-2">
                {importHistory.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-md border p-2 ${
                      item.status === 'error' ? 'border-rose-500/30 bg-rose-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{item.fileName}</p>
                        {item.status === 'success' && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.routeCount} ruta · {item.trackCount} sledi
                          </p>
                        )}
                        {item.status === 'error' && (
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
