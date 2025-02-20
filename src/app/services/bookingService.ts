import { DateTime } from 'luxon'
import { supabase } from '@/lib/supabase/client'
import { UserProfile } from '@/lib/supabase/types'
import { BookingFrequency, BookingStatus, GroupedTimeSlots, TimeSlot } from '../types/booking'

const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC';

export const bookingService = {
  saveUserProfile: async (profile: UserProfile) => {
    const profileData = {
      value: profile,
      expiry: new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
    }
    localStorage.setItem('userProfile', JSON.stringify(profileData))

    const { data, error } = await supabase
      .from('meetings_user_profiles')
      .upsert({
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        timezone: profile.timezone,
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
    if (typeof window === 'undefined') return null;
    
    try {
      const profileStr = localStorage.getItem('userProfile')
      if (!profileStr) return null

      const profileData = JSON.parse(profileStr)
      const now = new Date().getTime()

      if (now > profileData.expiry) {
        const newProfileData = {
          value: profileData.value,
          expiry: new Date().getTime() + (30 * 24 * 60 * 60 * 1000)
        }
        localStorage.setItem('userProfile', JSON.stringify(newProfileData))
      }

      return profileData.value
    } catch (error) {
      console.error('Error getting user profile from localStorage:', error)
      return null
    }
  },

  getAvailableSlots: async (date: Date, userTimezone: string): Promise<GroupedTimeSlots[]> => {
    // Convertir la fecha seleccionada a la timezone del usuario
    const userDateTime = DateTime.fromJSDate(date)
      .setZone(userTimezone)
      .startOf('day');
    
    // Obtener el rango UTC que necesitamos revisar (24 horas completas)
    const utcStartOfDay = userDateTime.minus({ days: 1 }).toUTC();
    const utcEndOfDay = userDateTime.plus({ days: 2 }).toUTC();
    
    // Obtener las reservas existentes
    const { data: existingBookings } = await supabase
      .from('meetings_bookings')
      .select('booking_date, recurring_day, recurring_time')
      .in('status', ['confirmed', 'pending-payment'])
      .or(`booking_date.gte.${utcStartOfDay.toISO()},booking_date.lt.${utcEndOfDay.toISO()}`);
    
    const slots: TimeSlot[] = [];
    
    // Revisar 72 horas para cubrir todas las zonas horarias
    for (let hour = 0; hour < 72; hour++) {
      const utcSlotDateTime = utcStartOfDay.plus({ hours: hour });
      const userSlotDateTime = utcSlotDateTime.setZone(userTimezone);
      const coachSlotDateTime = utcSlotDateTime.setZone(COACH_TIMEZONE);
      
      // Solo agregar slot si está en las horas permitidas del coach (1-4 AM y 12-4 PM UTC)
      const coachHour = coachSlotDateTime.hour;
      if ((coachHour >= 1 && coachHour <= 4) || (coachHour >= 12 && coachHour <= 16)) {
        // Verificar si el slot pertenece al día seleccionado en la timezone del usuario
        if (userSlotDateTime.startOf('day').equals(userDateTime.startOf('day'))) {
          if (userSlotDateTime >= DateTime.now().setZone(userTimezone)) {
            // Verificar si el slot ya está reservado
            const isBooked = existingBookings?.some(booking => {
              const bookingDateTime = DateTime.fromISO(booking.booking_date)
                .setZone(userTimezone);
              return bookingDateTime.hasSame(userSlotDateTime, 'hour');
            });

            slots.push({
              id: `${userDateTime.toFormat('yyyy-MM-dd')}-${coachHour}`,
              date: userSlotDateTime.toJSDate(),
              available: !isBooked,
              utcDate: utcSlotDateTime.toJSDate()
            });
          }
        }
      }
    }

    // Agrupar slots por día en la timezone del usuario
    const groupedSlots = slots.reduce((groups: GroupedTimeSlots[], slot) => {
      const slotDate = DateTime.fromJSDate(slot.date)
        .setZone(userTimezone)
        .startOf('day')
        .toJSDate()
        .getTime();

      const existingGroup = groups.find(g => 
        g.date.getTime() === slotDate
      );

      if (existingGroup) {
        existingGroup.slots.push(slot);
      } else {
        groups.push({
          date: new Date(slotDate),
          slots: [slot]
        });
      }

      return groups;
    }, []);

    groupedSlots.forEach(group => {
      group.slots.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    return groupedSlots;
  },

  createBooking: async (
    email: string, 
    startDate: Date, 
    frequency: BookingFrequency,
    endDate: Date | null,
    duration: number,
    secondDate?: Date,
    meetLink?: string
  ) => {
    try {
      // Convertir las fechas a UTC
      const startDateTime = DateTime.fromJSDate(startDate).toUTC();
      const endDateTime = endDate ? DateTime.fromJSDate(endDate).toUTC() : null;

      // Crear la reserva principal
      const mainBooking = {
        user_email: email,
        frequency,
        status: BookingStatus.PENDING_PAYMENT,
        booking_date: startDateTime.toJSDate(),
        end_date: endDateTime?.toJSDate() || null,
        duration,
        recurring_day: frequency !== 'once' ? DateTime.fromJSDate(startDate).weekdayLong : null,
        recurring_time: frequency !== 'once' ? startDateTime.toFormat('HH:mm') : null,
        meet_link: meetLink
      };

      const { data: savedBooking, error } = await supabase
        .from('meetings_bookings')
        .insert([mainBooking])
        .select()
        .single();

      if (error) throw error;

      // Si es twice-weekly, crear la segunda sesión en UTC
      if (frequency === 'twice-weekly' && secondDate) {
        const secondDateTime = DateTime.fromJSDate(secondDate).toUTC();
        const secondSession = {
          booking_id: savedBooking.id,
          booking_date: secondDateTime.toJSDate(),
          end_date: endDateTime?.toJSDate() || null,
          recurring_day: DateTime.fromJSDate(secondDate).weekdayLong,
          recurring_time: secondDateTime.toFormat('HH:mm')
        };

        const { error: secondError } = await supabase
          .from('multiple_bookings')
          .insert([secondSession]);

        if (secondError) throw secondError;
      }

      return [savedBooking];
    } catch (error) {
      console.error('Create booking error:', error);
      throw error;
    }
  },

  getFullyBookedDates: async (month: Date): Promise<Array<{ date: Date, fullyBooked: boolean }>> => {
    const startOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth(), 1)).startOf('day');
    const endOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)).endOf('day');
    
    const { data: bookings } = await supabase
      .from('meetings_bookings')
      .select('booking_date, frequency, recurring_day, recurring_time, end_date')
      .eq('status', 'confirmed')
      .or(`frequency.eq.once,frequency.neq.once`)
      .gte('booking_date', startOfMonth.toISO())
      .lte('booking_date', endOfMonth.toISO());

    if (!bookings) {
      throw new Error('Failed to fetch bookings');
    }
    const singleBookings = bookings.filter(b => b.frequency === 'once');
    const recurringBookings = bookings.filter(b => b.frequency !== 'once');

    const bookingsByDate = new Map<string, number>();
    const TOTAL_SLOTS_PER_DAY = 9;

    singleBookings.forEach(booking => {
      const dateStr = DateTime.fromISO(booking.booking_date).toFormat('yyyy-MM-dd');
      bookingsByDate.set(dateStr, (bookingsByDate.get(dateStr) || 0) + 1);
    });

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

    /* eslint-disable @typescript-eslint/no-unused-vars */
    return Array.from(bookingsByDate.entries())
      .filter(([_, count]) => count >= TOTAL_SLOTS_PER_DAY)
      .map(([dateStr, _]) => ({
        date: DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate(),
        fullyBooked: true
      }));
    /* eslint-enable @typescript-eslint/no-unused-vars */
  }
}