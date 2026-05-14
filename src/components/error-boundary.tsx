'use client'

import React from 'react'
import { Bike } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
          <Bike className="size-12 text-primary mb-4" />
          <h2 className="text-lg font-bold mb-2">Nekaj je šlo narobe</h2>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            Prišlo je do napake pri nalaganju aplikacije. Poskusite osvežiti stran.
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            variant="outline"
          >
            Osveži stran
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
