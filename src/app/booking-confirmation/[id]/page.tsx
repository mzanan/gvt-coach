'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/components/ui/card"
import Link from 'next/link'
import { BookingDB } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'
import { DateTime } from 'luxon'
import { use } from 'react'
import { getBookingSummary } from '@/lib/utils'

export default function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [booking, setBooking] = useState<BookingDB | null>(null)

  useEffect(() => {
    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from('meetings_bookings')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (data) {
        setBooking(data)
      }
    }

    fetchBooking()
  }, [resolvedParams.id])

  const formatBookingDate = () => {
    if (!booking) return '';
    
    return getBookingSummary(
      booking.booking_date,
      booking.frequency,
      booking.end_date ? DateTime.fromISO(booking.end_date).diff(DateTime.fromISO(booking.booking_date), 'months').months : null,
      true,
      'UTC'  // o usar el timezone del usuario si está disponible
    );
  }

  if (!booking) return null

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Link href="/" className="text-primary hover:underline mb-8 inline-block">
        ← Back to Calendar
      </Link>

      <Card className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-muted-foreground mb-6">You will receive this information in your email</p>

        <div className="space-y-4">
          <div>
            <h2 className="font-medium mb-1">Date and Time</h2>
            <p>{formatBookingDate()}</p>
          </div>

          <div>
            <h2 className="font-medium mb-1">Zoom Link</h2>
            <a href={booking.meet_link} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
              Join Meeting
            </a>
          </div>

          <div>
            <h2 className="font-medium mb-1">Booking ID</h2>
            <p className="font-mono text-sm">{booking.id}</p>
          </div>
        </div>
      </Card>
    </div>
  )
} 