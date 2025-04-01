'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookingCalendar } from "./components/features/booking/BookingCalendar"
import { Loader2 } from "lucide-react"
import { userService } from "@/services/userService"

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get user data from tn_profiles
        const profile = await userService.getUserFromAuthUsers()
        
        if (!profile) {
          console.error("Failed to load user profile")
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading user data:", error)
        setIsLoading(false)
      }
    }
    
    loadUserData()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="container mx-auto py-8">
      <BookingCalendar />
    </main>
  )
}
