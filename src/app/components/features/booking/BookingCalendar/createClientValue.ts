'use client'

import { useCallback, useSyncExternalStore } from 'react'

export function createClientValue<T>(
  read: () => T,
  serverValue: T,
  write: (value: T) => void
) {
  const listeners = new Set<() => void>()

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const getServerSnapshot = () => serverValue

  return function useClientValue(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, read, getServerSnapshot)

    const setValue = useCallback((next: T) => {
      write(next)
      listeners.forEach(listener => listener())
    }, [])

    return [value, setValue]
  }
}
