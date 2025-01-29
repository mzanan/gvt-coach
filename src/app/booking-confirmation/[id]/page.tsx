'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/components/ui/card"
import Link from 'next/link'
import { BookingDB } from '@/lib/supabase/types'
import { supabase } from '@/lib/supabase/client'
import { DateTime } from 'luxon'
import { use } from 'react'
import { BookingSummaryDisplay } from '@/app/components/BookingSummaryDisplay'
import { ChevronLeft, Check, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const userTimezone = (() => {
    if (typeof window !== 'undefined') {
      const profileData = localStorage.getItem('userProfile')
      if (profileData) {
        const parsed = JSON.parse(profileData)
        return parsed.value.timezone
      }
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  })()

  useEffect(() => {
    const fetchBooking = async () => {
      const { data: mainBooking, error } = await supabase
        .from('meetings_bookings')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (mainBooking) {
        if (mainBooking.frequency === 'twice-weekly') {
          const { data: secondBooking } = await supabase
            .from('meetings_bookings')
            .select('*')
            .eq('user_email', mainBooking.user_email)
            .eq('frequency', 'twice-weekly')
            .gt('booking_date', mainBooking.booking_date)
            .limit(1)
            .single();

          if (secondBooking) {
            // Calcular la duración en meses basada en las fechas
            const startDate = DateTime.fromISO(mainBooking.booking_date);
            const endDate = DateTime.fromISO(mainBooking.end_date);
            const durationInMonths = endDate.diff(startDate, 'months').months;

            setBooking({
              ...mainBooking,
              second_booking_date: secondBooking.booking_date,
              duration: Math.round(durationInMonths)
            });
          }
        } else {
          setBooking(mainBooking);
        }
      }
    }

    fetchBooking()
  }, [resolvedParams.id])

  if (!booking) return null

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