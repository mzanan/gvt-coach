import { supabase, getToken } from '@/lib/supabase/client'
import { BookingDB } from '@/lib/supabase/types'
import { DateTime } from 'luxon'

export async function fetchBookingById(id: string): Promise<BookingDB> {
  const token = await getToken()

  if (!token) {
    throw new Error('No authentication token available')
  }

  const response = await fetch(`/api/bookings/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const mainBooking = await response.json()
  
  if (mainBooking.frequency === 'twice-weekly') {
    const { data: secondBooking } = await supabase
      .from('meetings_bookings')
      .select('*')
      .eq('user_email', mainBooking.user_email)
      .eq('frequency', 'twice-weekly')
      .gt('booking_date', mainBooking.booking_date)
      .limit(1)
      .single()

    if (secondBooking) {
      const startDate = DateTime.fromISO(mainBooking.booking_date)
      const endDate = DateTime.fromISO(mainBooking.end_date)
      const durationInMonths = endDate.diff(startDate, 'months').months

      return {
        ...mainBooking,
        second_booking_date: secondBooking.booking_date,
        duration: Math.round(durationInMonths)
      }
    }
  }

  return mainBooking
}
