import { DateTime } from 'luxon'
import { supabase } from '@/lib/supabase/client'
import { BookingDB, UserProfile } from '@/lib/supabase/types'
import { Booking, BookingFrequency, TimeSlot } from '../types/booking'
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
    const userDateTime = DateTime.fromJSDate(date);
    const luxonDate = userDateTime.setZone('UTC', { keepLocalTime: true });
    
    const startOfDay = luxonDate.startOf('day');
    const endOfDay = luxonDate.endOf('day');

    // Obtener tanto las reservas normales como las recurrentes
    const { data: existingBookings, error } = await supabase
      .from('meetings_bookings')
      .select('booking_date, frequency, recurring_day, recurring_time, end_date')
      .eq('status', 'confirmed')
      .filter('booking_date', 'gte', startOfDay.toISO())
      .filter('booking_date', 'lte', endOfDay.toISO());

    if (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }

    const isSlotBooked = (slotDateTime: DateTime) => {
      return existingBookings?.some(booking => {
        if (booking.frequency === 'once') {
          const bookingDateTime = DateTime.fromISO(booking.booking_date);
          return bookingDateTime.toUTC().toMillis() === slotDateTime.toUTC().toMillis();
        } else if (booking.recurring_day === slotDateTime.weekdayLong && booking.recurring_time) {
          const startDate = DateTime.fromISO(booking.booking_date);
          const endDate = booking.end_date ? DateTime.fromISO(booking.end_date) : null;
          const bookingTime = booking.recurring_time;
          
          return slotDateTime >= startDate &&
                 (!endDate || slotDateTime <= endDate) &&
                 bookingTime === slotDateTime.toFormat('HH:mm');
        }
        return false;
      });
    };

    const slots: TimeSlot[] = [];

    // Morning slots (1 AM UTC = 8 AM Asia/Saigon)
    for (let hour = 1; hour <= 4; hour++) {
      const slotDateTime = luxonDate.set({ hour, minute: 0 });
      const localDateTime = slotDateTime.setZone(COACH_TIMEZONE);

      const isBooked = isSlotBooked(slotDateTime);

      slots.push({
        id: `${userDateTime.toFormat('yyyy-MM-dd')}-${hour}`,
        date: localDateTime.toJSDate(),
        available: !isBooked,
        utcDate: slotDateTime.toJSDate()
      });
    }

    // Evening slots (12 PM UTC = 7 PM Asia/Saigon)
    for (let hour = 12; hour <= 16; hour++) {
      const slotDateTime = luxonDate.set({ hour, minute: 0 });
      const localDateTime = slotDateTime.setZone(COACH_TIMEZONE);

      const isBooked = isSlotBooked(slotDateTime);

      slots.push({
        id: `${userDateTime.toFormat('yyyy-MM-dd')}-${hour}`,
        date: localDateTime.toJSDate(),
        available: !isBooked,
        utcDate: slotDateTime.toJSDate()
      });
    }

    return slots;
  },

  createBooking: async (
    email: string,
    startDate: Date,
    frequency: BookingFrequency,
    endDate: Date | null
  ): Promise<BookingDB> => {
    try {
      const startDateTime = DateTime.fromJSDate(startDate).toUTC();
      const endDateTime = endDate ? DateTime.fromJSDate(endDate).toUTC() : null;
      
      // Crear un solo link de Zoom para todas las recurrencias
      const meetLink = await zoomService.createMeeting(startDate);

      const booking = {
        user_email: email,
        booking_date: startDateTime.toISO(),
        end_date: endDateTime?.toISO() || null,
        frequency,
        status: 'confirmed',
        meet_link: meetLink,
        recurring_day: frequency !== 'once' ? startDateTime.weekdayLong : null,
        recurring_time: frequency !== 'once' ? startDateTime.toFormat('HH:mm') : null
      };

      const { data: savedBooking, error } = await supabase
        .from('meetings_bookings')
        .insert(booking)
        .select()
        .single();

      if (error) throw error;
      return savedBooking;
    } catch (error) {
      console.error('Create booking error:', error);
      throw error;
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
    const startOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth(), 1)).startOf('day');
    const endOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)).endOf('day');
    
    // Primero obtenemos las reservas únicas
    const { data: singleBookings, error: singleError } = await supabase
      .from('meetings_bookings')
      .select('booking_date')
      .eq('status', 'confirmed')
      .eq('frequency', 'once')
      .gte('booking_date', startOfMonth.toISO())
      .lte('booking_date', endOfMonth.toISO());

    if (singleError) throw singleError;

    // Luego obtenemos las reservas recurrentes
    const { data: recurringBookings, error: recurringError } = await supabase
      .from('meetings_bookings')
      .select('booking_date, recurring_day, recurring_time, end_date')
      .eq('status', 'confirmed')
      .neq('frequency', 'once');

    if (recurringError) throw recurringError;

    const bookingsByDate = new Map<string, number>();
    const TOTAL_SLOTS_PER_DAY = 9;

    // Procesar reservas únicas
    singleBookings.forEach(booking => {
      const dateStr = DateTime.fromISO(booking.booking_date).toFormat('yyyy-MM-dd');
      bookingsByDate.set(dateStr, (bookingsByDate.get(dateStr) || 0) + 1);
    });

    // Procesar reservas recurrentes
    for (let d = startOfMonth; d <= endOfMonth; d = d.plus({ days: 1 })) {
      const dateStr = d.toFormat('yyyy-MM-dd');
      let currentCount = bookingsByDate.get(dateStr) || 0;

      recurringBookings.forEach(booking => {
        if (booking.recurring_day === d.weekdayLong) {
          const startDate = DateTime.fromISO(booking.booking_date);
          const endDate = booking.end_date ? DateTime.fromISO(booking.end_date) : null;
          
          if (d >= startDate && (!endDate || d <= endDate)) {
            currentCount++;
          }
        }
      });

      if (currentCount > 0) {
        bookingsByDate.set(dateStr, currentCount);
      }
    }

    return Array.from(bookingsByDate.entries())
      .filter(([_, count]) => count >= TOTAL_SLOTS_PER_DAY)
      .map(([dateStr, _]) => ({
        date: DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate(),
        fullyBooked: true
      }));
  },

  createRecurringBookings: async (
    startDate: Date,
    frequency: BookingFrequency,
    duration: number,
    userEmail: string,
    meetLink: string
  ) => {
    const start = DateTime.fromJSDate(startDate)
    const end = start.plus({ months: duration })

    const { data, error } = await supabase
      .from('meetings_bookings')
      .insert({
        user_email: userEmail,
        booking_date: startDate.toISOString(),
        end_date: end.toJSON(),
        frequency: frequency,
        status: 'confirmed',
        meet_link: meetLink,
        recurring_day: start.toFormat('cccc'),
        recurring_time: start.toFormat('HH:mm')
      })

    if (error) throw error
    return data
  }
} 