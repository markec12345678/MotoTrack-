'use client'

import React, { useState, useEffect } from 'react'

export default function LeanAngleDisplay() {
  const [angle, setAngle] = useState(0)
  const [maxLeft, setMaxLeft] = useState(0)
  const [maxRight, setMaxRight] = useState(0)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        const lean = Math.round(e.gamma)
        setAngle(lean)
        if (lean < 0) setMaxLeft(prev => Math.min(prev, lean))
        if (lean > 0) setMaxRight(prev => Math.max(prev, lean))
      }
    }
    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation)
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [])

  const getColor = (a: number) => {
    const abs = Math.abs(a)
    if (abs < 20) return '#22c55e'
    if (abs < 35) return '#eab308'
    if (abs < 45) return '#f97316'
    return '#ef4444'
  }

  if (!supported) return null

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-8 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-16 rounded-t-full border-2 border-muted" style={{ background: `conic-gradient(${getColor(angle)} ${50 + angle}%, transparent ${50 + angle}%)`, transformOrigin: 'center bottom' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-8 bg-foreground origin-bottom transition-transform" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <div className="text-xs">
        <p className="font-bold text-sm" style={{ color: getColor(angle) }}>{angle}°</p>
        <p className="text-muted-foreground">⬅ {Math.abs(maxLeft)}° | {maxRight}° ➡</p>
      </div>
    </div>
  )
}
