'use client'

import React, { useState, useEffect } from 'react'
import { ClipboardCheck, SkipForward, Play, Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const CHECKLIST_ITEMS = [
  { id: 'helmet', label: 'Čelada', emoji: '🪖' },
  { id: 'gloves', label: 'Rokavice', emoji: '🧤' },
  { id: 'jacket', label: 'Jakna', emoji: '🧥' },
  { id: 'boots', label: 'Škornji', emoji: '👢' },
  { id: 'phone', label: 'Telefon napolnjen', emoji: '📱' },
  { id: 'documents', label: 'Dokumenti', emoji: '🔑' },
  { id: 'fuel', label: 'Gorivo', emoji: '⛽' },
  { id: 'tires', label: 'Pritisk v pnevmatikah', emoji: '🛞' },
  { id: 'lights', label: 'Luči delujejo', emoji: '🔦' },
  { id: 'chain', label: 'Veriga/tekočina', emoji: '🪛' },
]

const STORAGE_KEY = 'mototrack-preride-checklist'

interface PreRideChecklistProps {
  open: boolean
  onClose: (skipped: boolean) => void
  onStartRide: () => void
}

export default function PreRideChecklist({ open, onClose, onStartRide }: PreRideChecklistProps) {
  // Initialize from localStorage
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Save to localStorage on change
  useEffect(() => {
    if (open && Object.keys(checked).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
    }
  }, [checked, open])

  const toggleItem = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const totalItems = CHECKLIST_ITEMS.length
  const progressPct = (checkedCount / totalItems) * 100
  const allChecked = checkedCount === totalItems
  const enoughChecked = checkedCount >= 5

  const handleStartRide = () => {
    onStartRide()
    onClose(false)
  }

  const handleSkip = () => {
    onClose(true)
  }

  const handleCheckAll = () => {
    const allChecked: Record<string, boolean> = {}
    CHECKLIST_ITEMS.forEach(item => { allChecked[item.id] = true })
    setChecked(allChecked)
  }

  const handleUncheckAll = () => {
    setChecked({})
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-primary/80 to-primary/40 p-4">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            Pre-Ride Checklist
          </DialogTitle>
          <p className="text-white/80 text-xs mt-1">Preverite opremo pred vožnjo</p>
        </div>

        {/* Progress */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">{checkedCount}/{totalItems} preverjeno</span>
            <span className={`font-bold ${allChecked ? 'text-green-500' : enoughChecked ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {allChecked ? '✓ Vse OK!' : enoughChecked ? `${checkedCount}/${totalItems}` : 'Preverite opremo'}
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Checklist items */}
        <div className="px-4 py-2 space-y-1.5 max-h-[320px] overflow-y-auto">
          {CHECKLIST_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all text-left ${
                checked[item.id]
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-border/30 bg-muted/30 hover:border-primary/30'
              }`}
            >
              <span className="text-base shrink-0">{item.emoji}</span>
              <span className={`flex-1 text-xs font-medium ${checked[item.id] ? 'text-green-400 line-through' : ''}`}>
                {item.label}
              </span>
              <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                checked[item.id]
                  ? 'border-green-500 bg-green-500'
                  : 'border-muted-foreground/30'
              }`}>
                {checked[item.id] && <Check className="size-3 text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="px-4 py-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1 flex-1"
            onClick={handleCheckAll}
          >
            <Check className="size-3" /> Označi vse
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1 flex-1"
            onClick={handleUncheckAll}
          >
            <X className="size-3" /> Počisti
          </Button>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1.5 h-9"
            onClick={handleSkip}
          >
            <SkipForward className="size-3.5" />
            Preskoči
          </Button>
          <Button
            size="sm"
            className={`flex-1 text-xs gap-1.5 h-9 ${
              allChecked
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-primary hover:bg-primary/90'
            }`}
            onClick={handleStartRide}
          >
            <Play className="size-3.5" />
            {allChecked ? 'Začni vožnjo ✓' : enoughChecked ? 'Začni vožnjo' : 'Preveri opremo'}
          </Button>
        </div>

        {/* Warning if not enough checked */}
        {!enoughChecked && checkedCount > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[9px] text-amber-400 text-center">
              ⚠️ Priporočamo preverjanje vsaj 5 postavk pred vožnjo
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
