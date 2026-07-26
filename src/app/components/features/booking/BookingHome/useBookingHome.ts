'use client'

import { useEffect, useState } from 'react'
import { userService } from '@/services/userService'

export function useBookingHome() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const profile = await userService.getUserFromAuthUsers()

        if (!profile) {
          console.error('Failed to load user profile')
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading user data:', error)
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [])

  return { isLoading }
}
