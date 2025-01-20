import { supabase } from '@/lib/supabase/client'
import { BookingDB, UserProfile } from '@/lib/supabase/types'
import { Booking, TimeSlot } from '../types/booking'

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
    // Ajustamos la fecha para que sea UTC y evitar problemas de zona horaria
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Obtenemos las reservas existentes para el día
    const { data: existingBookings, error } = await supabase
      .from('meetings_bookings')
      .select('booking_date')
      .eq('status', 'confirmed')
      .gte('booking_date', startOfDay.toISOString())
      .lt('booking_date', endOfDay.toISOString())

    if (error) {
      console.error('Error fetching bookings:', error)
      throw error
    }

    const slots: TimeSlot[] = []
    
    // Creamos slots para cada hora entre 9 AM y 4 PM
    for (let hour = 9; hour < 17; hour++) {
      const slotDate = new Date(date)
      slotDate.setHours(hour, 0, 0, 0)
      
      // Verificamos si el slot está reservado
      const isBooked = existingBookings?.some(booking => {
        const bookingDate = new Date(booking.booking_date)
        return bookingDate.getHours() === hour
      })
      
      slots.push({
        id: `${date.toDateString()}-${hour}`,
        date: slotDate,
        available: !isBooked
      })
    }
    
    return slots
  },

  createBooking: async (userEmail: string, date: Date): Promise<Booking> => {
    try {
      const { data, error } = await supabase
        .from('meetings_bookings')
        .insert({
          user_email: userEmail,
          booking_date: date.toISOString(),
          status: 'confirmed',
          meet_link: `https://meet.google.com/oja-gwke-wnk`
        })
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        userId: userEmail,
        date: new Date(data.booking_date),
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
  }
} 