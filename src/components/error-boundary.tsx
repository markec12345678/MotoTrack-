'use client'

import React from 'react'
import { Bike, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  isRetrying: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, isRetrying: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, isRetrying: false }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ isRetrying: true })
    // Small delay before retry to allow chunk to be available
    setTimeout(() => {
      this.setState({ hasError: false, error: null, isRetrying: false })
    }, 1000)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
        this.state.error?.message?.includes('Failed to load chunk')

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
          <Bike className="size-12 text-primary mb-4" />
          <h2 className="text-lg font-bold mb-2">Nekaj je šlo narobe</h2>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            {isChunkError 
              ? 'Napaka pri nalaganju komponente. Poskusite znova ali osvežite stran.'
              : 'Prišlo je do napake pri nalaganju aplikacije. Poskusite osvežiti stran.'
            }
          </p>
          <div className="flex gap-2">
            {isChunkError && (
              <Button
                onClick={this.handleRetry}
                variant="default"
                disabled={this.state.isRetrying}
              >
                {this.state.isRetrying ? (
                  <><RefreshCw className="size-4 mr-2 animate-spin" /> Nalaganje...</>
                ) : (
                  <><RefreshCw className="size-4 mr-2" /> Poskusi znova</>
                )}
              </Button>
            )}
            <Button
              onClick={this.handleReload}
              variant="outline"
            >
              Osveži stran
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
