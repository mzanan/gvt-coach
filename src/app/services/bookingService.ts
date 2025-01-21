import { DateTime } from 'luxon'
import { supabase } from '@/lib/supabase/client'
import { BookingDB, UserProfile } from '@/lib/supabase/types'
import { Booking, TimeSlot } from '../types/booking'
import { zoomService } from './zoomService'

const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC'; // Default to UTC if not set

export const bookingService = {
  saveUserProfile: async (profile: UserProfile) => {
    // Guardar en localStorage
    const profileData = {
      value: profile,
      expiry: new Date().getTime() + 24 * 60 * 60 * 1000 // 24 horas
    }
    localStorage.setItem('userProfile', JSON.stringify(profileData))

    // Actualizar en Supabase
    const { data, error } = await supabase
      .from('meetings_user_profiles')
      .upsert({
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'
      })

    if (error) {
      console.error('Error saving user profile:', error)
      throw error
    }

    return data
  },

  getUserProfile: (): UserProfile | null => {
    const profileStr = localStorage.getItem('userProfile')
    if (!profileStr) return null

    const profileData = JSON.parse(profileStr)
    const now = new Date().getTime()

    // Check if data has expired
    if (now > profileData.expiry) {
      localStorage.removeItem('userProfile')
      return null
    }

    return profileData.value
  },

  getAvailableSlots: async (date: Date): Promise<TimeSlot[]> => {
    const luxonDate = DateTime.fromJSDate(date).setZone(COACH_TIMEZONE);
    const startOfDay = luxonDate.startOf('day');
    const endOfDay = luxonDate.endOf('day');

    const { data: existingBookings, error } = await supabase
      .from('meetings_bookings')
      .select('booking_date')
      .eq('status', 'confirmed')
      .gte('booking_date', startOfDay.toISO())
      .lt('booking_date', endOfDay.toISO());

    if (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }

    const slots: TimeSlot[] = [];

    // Morning slots (8 AM to 11 AM)
    for (let hour = 1; hour <= 4; hour++) {
      const slotDateTime = luxonDate.set({ hour, minute: 0 });

      const isBooked = existingBookings?.some(booking => {
        const bookingDateTime = DateTime.fromISO(booking.booking_date).setZone(COACH_TIMEZONE);
        return bookingDateTime.hour === hour;
      });

      slots.push({
        id: `${date.toDateString()}-${hour}`,
        date: slotDateTime.toJSDate(),
        available: !isBooked
      });
    }

    // Evening slots (7 PM to 11 PM)
    for (let hour = 12; hour <= 16; hour++) {
      const slotDateTime = luxonDate.set({ hour, minute: 0 });

      const isBooked = existingBookings?.some(booking => {
        const bookingDateTime = DateTime.fromISO(booking.booking_date).setZone(COACH_TIMEZONE);
        return bookingDateTime.hour === hour;
      });

      slots.push({
        id: `${date.toDateString()}-${hour}`,
        date: slotDateTime.toJSDate(),
        available: !isBooked
      });
    }

    return slots;
  },

  createBooking: async (userEmail: string, date: Date): Promise<Booking> => {
    try {
      const bookingDateTime = DateTime.fromJSDate(date)
      const meetLink = await zoomService.createMeeting(date)

      if (!meetLink) {
        throw new Error('Failed to generate meeting link')
      }

      const { data, error } = await supabase
        .from('meetings_bookings')
        .insert({
          user_email: userEmail,
          booking_date: bookingDateTime.toISO(),
          status: 'confirmed',
          meet_link: meetLink
        })
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        userId: userEmail,
        date: DateTime.fromISO(data.booking_date).toJSDate(),
        status: data.status,
        meetLink: data.meet_link
      }
    } catch (error) {
      console.error('Create booking error:', error)
      throw error
    }
  },

  getUserBookings: async (userEmail: string): Promise<Booking[]> => {
    const { data, error } = await supabase
      .from('meetings_bookings')
      .select('*')
      .eq('user_email', userEmail)
      .order('booking_date', { ascending: true })

    if (error) throw error

    return data.map((booking: BookingDB) => ({
      id: booking.id,
      userId: booking.user_email,
      date: new Date(booking.booking_date),
      status: booking.status,
      meetLink: booking.meet_link
    }))
  },

  getBooking: async (id: string): Promise<Booking> => {
    const { data, error } = await supabase
      .from('meetings_bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return {
      id: data.id,
      userId: data.user_email,
      date: new Date(data.booking_date),
      status: data.status,
      meetLink: data.meet_link
    }
  },

  getFullyBookedDates: async (month: Date): Promise<Array<{ date: Date, fullyBooked: boolean }>> => {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    
    const { data: bookings, error } = await supabase
      .from('meetings_bookings')
      .select('booking_date')
      .eq('status', 'confirmed')
      .gte('booking_date', startOfMonth.toISOString())
      .lt('booking_date', endOfMonth.toISOString())

    if (error) {
      console.error('Error fetching booked dates:', error)
      throw error
    }

    // Group bookings by date
    const bookingsByDate = bookings.reduce((acc: { [key: string]: number }, booking) => {
      const date = new Date(booking.booking_date).toDateString()
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    // Find dates with all slots booked (in this case, 2 slots per day)
    return Object.entries(bookingsByDate)
      .filter(([_, count]) => count >= 2) // Since you have 2 slots (9AM and 10AM)
      .map(([dateStr]) => ({
        date: new Date(dateStr),
        fullyBooked: true
      }))
  }
} 