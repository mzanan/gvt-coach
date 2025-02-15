import { DateTime } from 'luxon'
import { supabase } from '@/lib/supabase/client'
import { BookingDB, UserProfile } from '@/lib/supabase/types'
import { Booking, BookingFrequency, TimeSlot } from '../types/booking'
import { zoomService } from './zoomService'

const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC'; // Default to UTC if not set

interface GroupedTimeSlots {
  date: Date;
  slots: TimeSlot[];
}

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
      .eq('status', 'confirmed')
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

  createBooking: async (email: string, startDate: Date, frequency: string, endDate: Date | null) => {
    try {
      const meetLink = await zoomService.createMeeting(startDate); 
      const startDateTime = DateTime.fromJSDate(startDate);
      const endDateTime = endDate ? DateTime.fromJSDate(endDate) : null;
      
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
    
    const { data: singleBookings, error: singleError } = await supabase
      .from('meetings_bookings')
      .select('booking_date')
      .eq('status', 'confirmed')
      .eq('frequency', 'once')
      .gte('booking_date', startOfMonth.toISO())
      .lte('booking_date', endOfMonth.toISO());

    if (singleError) throw singleError;

    const { data: recurringBookings, error: recurringError } = await supabase
      .from('meetings_bookings')
      .select('booking_date, recurring_day, recurring_time, end_date')
      .eq('status', 'confirmed')
      .neq('frequency', 'once');

    if (recurringError) throw recurringError;

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
  },

  formatSlotTime: (date: Date, selectedTimezone: string) => {
    const slotDateTime = DateTime.fromJSDate(date).setZone(selectedTimezone);
    const today = DateTime.now().setZone(selectedTimezone).startOf('day');
    const slotDate = slotDateTime.startOf('day');
    
    let prefix = '';
    if (slotDate < today) {
      prefix = 'Previous day - ';
    } else if (slotDate > today) {
      prefix = 'Next day - ';
    }
    
    return `${prefix}${slotDateTime.toFormat('hh:mm a')}`;
  },

  getTimezoneInfo: (userTimezone: string, coachTimezone: string) => {
    const userTZ = DateTime.local().setZone(userTimezone);
    const coachTZ = DateTime.local().setZone(coachTimezone);
    const hoursDiff = Math.abs(userTZ.offset - coachTZ.offset) / 60;
    
    return {
      hoursDiff,
      hasSignificantDifference: hoursDiff >= 6
    };
  }
}