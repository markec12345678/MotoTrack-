'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const Home = dynamic(() => import('@/components/home'), { ssr: false })

function SimpleLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">MotoTrack</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<SimpleLoadingFallback />}>
      <Home />
    </Suspense>
  )
}
