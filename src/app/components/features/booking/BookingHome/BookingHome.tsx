'use client'

import { BookingCalendar } from "../BookingCalendar"
import { Loader2 } from "lucide-react"
import { useBookingHome } from './useBookingHome'

export function BookingHome() {
  const { isLoading } = useBookingHome()

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="page-container py-8">
      <BookingCalendar />
    </main>
  )
}
