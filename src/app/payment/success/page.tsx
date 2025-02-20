'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { ChevronLeft, Check, Video } from "lucide-react"
import { Loader2 } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/BookingSummaryDisplay'
import { useRouter } from 'next/navigation'
import { BookingDB } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'

export default function PaymentSuccessPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const router = useRouter()

  useEffect(() => {
    const pendingBooking = localStorage.getItem('pendingBooking')
    if (!pendingBooking) {
      router.push('/')
      return
    }
    
    const bookingData = JSON.parse(pendingBooking)
    setUserTimezone(bookingData.selectedTimezone)
    
    // Usar el booking guardado en lugar de hacer una nueva consulta
    setBooking(bookingData.booking)
    setIsLoading(false)
    localStorage.removeItem('pendingBooking')
  }, [router])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Processing your booking...</h1>
          <p className="text-muted-foreground">Please wait while we confirm your payment</p>
        </Card>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">Unable to load booking details</p>
          <div className="mt-8">
            <Button variant="outline" asChild>
              <Link href="/">
                Return to Calendar
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Link href="/" className="text-primary hover:underline mb-8 inline-flex items-center gap-2">
        <ChevronLeft className="h-4 w-4" />
        Back to Calendar
      </Link>

      <Card className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">You will receive this information in your email</p>
        </div>

        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Schedule Details</h2>
            <div className="space-y-2 text-muted-foreground">
              <BookingSummaryDisplay 
                booking={booking}
                timezone={userTimezone}
              />
            </div>
          </div>

          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Meeting Link</h2>
            <a 
              href={booking.meet_link} 
              className="inline-flex items-center gap-2 text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Video className="h-4 w-4" />
              Join Zoom Meeting
            </a>
          </div>

          <div>
            <h2 className="font-medium text-lg mb-2">Booking Reference</h2>
            <p className="font-mono text-sm text-muted-foreground">{booking.id}</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/">
              Book Another Session
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}