'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookingCalendar } from "./components/features/booking/BookingCalendar"
import { Loader2 } from "lucide-react"
import { userService } from "@/services/userService"

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get user data from tn_profiles
        const profile = await userService.getUserFromAuthUsers()
        
        if (profile) {
          // Update state with obtained profile
          console.log("%c PROFILE IN PAGE ", "background: #222; color: #ff5a5a", profile);
          setUserProfile(profile)
        } else {
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
