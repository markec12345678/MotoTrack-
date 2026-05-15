'use client'

import { useState, useEffect } from 'react'

/**
 * Debounce a value by the given delay in ms.
 * Returns the debounced value that only updates after the delay has elapsed
 * since the last change. Perfect for search inputs to avoid heavy
 * re-computation on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
