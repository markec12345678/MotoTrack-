'use client'

import React from 'react'
import {
  Sparkles,
  Search,
  Mic,
  Activity,
  Download,
  Film,
  Sun,
  Moon,
  Bike,
  Bell,
  Share2,
  ChevronRight,
  Settings,
  HelpCircle,
  Info,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface HeaderDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Actions
  onOpenFeatureHub: () => void
  onOpenSearch: () => void
  onToggleVoice: () => void
  onToggleTwistiness: () => void
  onOpenExport: () => void
  onOpenSimulator: () => void
  onToggleTheme: () => void
  // State indicators
  voiceEnabled: boolean
  showTwistiness: boolean
  theme: string | undefined
  // Components rendered externally (they manage their own state)
  notificationBell: React.ReactNode
  shareButton: React.ReactNode
  nightModeToggle: React.ReactNode
}

export default function HeaderDrawer({
  open,
  onOpenChange,
  onOpenFeatureHub,
  onOpenSearch,
  onToggleVoice,
  onToggleTwistiness,
  onOpenExport,
  onOpenSimulator,
  onToggleTheme,
  voiceEnabled,
  showTwistiness,
  theme,
  notificationBell,
  shareButton,
  nightModeToggle,
}: HeaderDrawerProps) {
  const handleClose = (action: () => void) => {
    onOpenChange(false)
    // Small delay so drawer closes first
    setTimeout(action, 150)
  }

  const menuSections = [
    {
      title: 'Orodja',
      items: [
        {
          icon: Sparkles,
          label: 'Napredne funkcije',
          description: 'Feature Hub z vsemi dodatki',
          badge: 'NEW',
          active: false,
          onClick: () => handleClose(onOpenFeatureHub),
        },
        {
          icon: Search,
          label: 'Iskanje',
          description: 'Poišči rute, vožnje, kraje (Ctrl+K)',
          active: false,
          onClick: () => handleClose(onOpenSearch),
        },
        {
          icon: Mic,
          label: 'Glasovni ukazi',
          description: 'Hands-free nadzor med vožnjo',
          active: voiceEnabled,
          activeColor: 'text-red-400',
          onClick: () => { onToggleVoice(); onOpenChange(false) },
        },
      ],
    },
    {
      title: 'Zemljevid',
      items: [
        {
          icon: Activity,
          label: 'Heatmap vijugavosti',
          description: 'Prikaži vijugavost cest na zemljevidu',
          active: showTwistiness,
          activeColor: 'text-emerald-400',
          onClick: () => { onToggleTwistiness(); onOpenChange(false) },
        },
        {
          icon: Film,
          label: 'Simulacija rute',
          description: 'Animirani prelet načrtovane rute',
          active: false,
          onClick: () => handleClose(onOpenSimulator),
        },
      ],
    },
    {
      title: 'Izvozi in deli',
      items: [
        {
          icon: Download,
          label: 'Izvozi vožnjo',
          description: 'GPX, TCX, KML, CSV formati',
          active: false,
          onClick: () => handleClose(onOpenExport),
        },
      ],
    },
    {
      title: 'Videz',
      items: [
        {
          icon: theme === 'dark' ? Sun : Moon,
          label: theme === 'dark' ? 'Svetla tema' : 'Temna tema',
          description: theme === 'dark' ? 'Preklopi na svetli način' : 'Preklopi na temni način',
          active: false,
          onClick: () => { onToggleTheme(); onOpenChange(false) },
        },
      ],
    },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:max-w-[320px] p-0">
        <SheetHeader className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-10 rounded-xl bg-primary shadow-md shadow-primary/25">
              <Bike className="size-5 text-primary-foreground" strokeWidth={2.5} />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            </div>
            <div>
              <SheetTitle className="text-left font-black logo-gradient tracking-tight">
                MotoTrack
              </SheetTitle>
              <SheetDescription className="text-left text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground/50">
                GPS Sledenje
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Inline components */}
        <div className="px-4 pb-3 flex items-center gap-2">
          {notificationBell}
          {shareButton}
          {nightModeToggle}
        </div>

        <Separator />

        {/* Menu sections */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx}>
              <div className="px-4 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                  {section.title}
                </span>
              </div>
              {section.items.map((item, iIdx) => (
                <button
                  key={iIdx}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors active:bg-accent/60 text-left"
                >
                  <div className={`flex items-center justify-center size-9 rounded-xl ${
                    item.active
                      ? `bg-primary/10 ${item.activeColor || 'text-primary'}`
                      : 'bg-muted/30 text-muted-foreground'
                  }`}>
                    <item.icon className="size-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        item.active ? item.activeColor || 'text-primary' : 'text-foreground'
                      }`}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider">
                          {item.badge}
                        </span>
                      )}
                      {item.active && !item.badge && (
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 truncate">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground/20" />
                </button>
              ))}
              {sIdx < menuSections.length - 1 && <Separator className="mt-2" />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/40">
            <span>MotoTrack v1.0.0</span>
            <span>by Markec</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
