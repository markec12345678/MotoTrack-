'use client'

import React, { useState, useEffect } from 'react'
import { Moon, Sun, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NightModeToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export default function NightModeToggle({ enabled, onToggle }: NightModeToggleProps) {
  // Auto-detect night time (after 8pm or before 6am)
  useEffect(() => {
    const hour = new Date().getHours()
    if ((hour >= 20 || hour < 6) && !enabled) {
      // Suggest night mode (but don't force it)
    }
  }, [enabled])

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(!enabled)}
      className={`gap-1.5 text-xs h-8 px-2.5 transition-all ${
        enabled
          ? 'bg-red-900/50 text-red-300 border border-red-500/30 hover:bg-red-900/70'
          : 'hover:bg-secondary'
      }`}
      title={enabled ? 'Izklopi nočni način' : 'Vklopi nočni način (zaščita vida)'}
    >
      {enabled ? (
        <>
          <Moon className="size-3.5" />
          <span className="hidden sm:inline">Nočni</span>
        </>
      ) : (
        <>
          <Eye className="size-3.5" />
          <span className="hidden sm:inline">Nočni</span>
        </>
      )}
    </Button>
  )
}

// CSS class to apply red tint overlay for night riding
// Applied as a wrapper div with this class
export const NIGHT_MODE_STYLES = `
  .night-mode-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    background: rgba(255, 0, 0, 0.08);
    mix-blend-mode: multiply;
  }
  
  .night-mode-overlay .leaflet-tile {
    filter: saturate(0.3) brightness(0.5) sepia(1) hue-rotate(-30deg);
  }
  
  .night-mode-active {
    --night-filter: saturate(0.6) brightness(0.7) sepia(0.3) hue-rotate(-10deg);
  }
  
  .night-mode-active .bg-white,
  .night-mode-active .bg-background {
    filter: var(--night-filter);
  }
`
