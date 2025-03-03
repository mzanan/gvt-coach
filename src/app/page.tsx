'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookingCalendar } from "./components/BookingCalendar"
import { bookingService } from "./services/bookingService"

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)


  useEffect(() => {
    const checkAuth = () => {
      const userProfile = bookingService.getUserProfile()
      if (!userProfile) {
        router.replace('/auth/login')
        return
      }
      setIsLoading(false)
    }
    
    checkAuth()
  }, [router])

  if (isLoading) {
    return null
  }

  return (
    <main className="container mx-auto py-8">
      <BookingCalendar />
    </main>
  )
}
