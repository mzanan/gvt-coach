import { DateTime } from 'luxon'
import { supabase, getToken } from '@/lib/supabase/client'
import { UserProfile } from '@/app/types/user'
import { BookingDB } from '@/app/types/booking'
import { BookingFrequency, GroupedTimeSlots, TimeSlot } from '@/app/types/booking'

const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC';

// Cache para almacenar resultados y reducir llamadas innecesarias
const cache = {
  availableSlots: new Map<string, {data: GroupedTimeSlots[], timestamp: number}>(),
  bookedDates: { data: null as Array<{ date: Date, fullyBooked: boolean }> | null, timestamp: 0 },
  bookings: new Map<string, {data: BookingDB, timestamp: number}>(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutos
  
  isValid: function(timestamp: number) {
    return Date.now() - timestamp < this.CACHE_DURATION;
  },
  
  clearAll: function() {
    this.availableSlots.clear();
    this.bookedDates = { data: null, timestamp: 0 };
    this.bookings.clear();
  }
};

export const bookingService = {
  fetchBookingById: async (id: string): Promise<BookingDB> => {
    // Verificar si tenemos el booking en caché
    const cachedBooking = cache.bookings.get(id);
    if (cachedBooking && cache.isValid(cachedBooking.timestamp)) {
      return cachedBooking.data;
    }
    
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

        const result = {
          ...mainBooking,
          second_booking_date: secondBooking.booking_date,
          duration: Math.round(durationInMonths)
        };
        
        // Guardar en caché
        cache.bookings.set(id, {data: result, timestamp: Date.now()});
        return result;
      }
    }
    
    // Guardar en caché
    cache.bookings.set(id, {data: mainBooking, timestamp: Date.now()});
    return mainBooking
  },

  saveUserProfile: async (profile: UserProfile) => {
    // Implementamos una función para manejar localStorage de forma más segura
    const saveToLocalStorage = (key: string, value: unknown, expiryInMillis: number) => {
      if (typeof window === 'undefined') return;
      
      try {
        const data = {
          value,
          expiry: new Date().getTime() + expiryInMillis
        };
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
    };
    
    // Guardamos el perfil en localStorage
    saveToLocalStorage('userProfile', profile, 30 * 24 * 60 * 60 * 1000);

    // También guardamos en la base de datos
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

      // Si el perfil ha expirado, actualizamos el tiempo de expiración
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
    // Clave de caché usando fecha y zona horaria - usamos solo la fecha sin tiempo para mejor caché
    const dateString = DateTime.fromJSDate(date).setZone(userTimezone).startOf('day').toFormat('yyyy-MM-dd');
    const cacheKey = `slots-${dateString}-${userTimezone}`;
    
    // Verificar si tenemos los slots disponibles en caché
    const cachedSlots = cache.availableSlots.get(cacheKey);
    if (cachedSlots && cache.isValid(cachedSlots.timestamp)) {
      console.log('Returning cached slots for', dateString);
      return cachedSlots.data;
    }
    
    // Agregar la hora actual en la timezone seleccionada para debug
    const now = DateTime.now().setZone(userTimezone);
    console.log(`Fetching slots for ${dateString} - Current time in ${userTimezone}: ${now.toFormat('yyyy-MM-dd HH:mm:ss')}`);
    
    const userDateTime = DateTime.fromJSDate(date)
      .setZone(userTimezone)
      .startOf('day');
    
    const utcStartOfDay = userDateTime.minus({ days: 0 }).toUTC(); // Reducido de 1 a 0 días
    const utcEndOfDay = userDateTime.plus({ days: 1 }).toUTC(); // Reducido de 2 a 1 día
    
    // Optimizamos las consultas - pre-creamos condición OR para mejorar rendimiento
    const dateCondition = `booking_date.gte.${utcStartOfDay.toISO()},booking_date.lt.${utcEndOfDay.toISO()}`;
    
    // Optimizamos las consultas
    const [mainBookingsResult] = await Promise.all([
      // Obtener las reservas con pagos confirmados o activos (excluyendo pendientes)
      supabase
        .from('meetings_bookings')
        .select(`
          booking_date, 
          recurring_time
        `)
        .or(dateCondition)
        .in('payments_status.status', ['PAID', 'ACTIVE']),
        
        // FUTURE IMPLEMENTATION: Re-enable weekly and twice-weekly booking options
        /*
        supabase
          .from('multiple_bookings')
          .select(`
            booking_date, 
            recurring_time
          `)
          .or(dateCondition)
          .in('meetings_bookings.payments_status.status', ['PAID', 'ACTIVE'])
        */
    ]);
    
    const mainBookings = mainBookingsResult.data || [];
    // Definir el tipo explícitamente para evitar errores de tipo
    const secondaryBookings: { booking_date: string; recurring_time: string }[] = []; // Lo inicializamos vacío ya que no lo estamos usando por ahora
    
    // Preparar un mapa para búsqueda más rápida de slots ocupados
    const bookedSlotsMap = new Map();
    
    // Añadir todas las reservas al mapa para búsqueda O(1) en lugar de O(n)
    [...mainBookings, ...secondaryBookings].forEach(booking => {
      const bookingDateTime = DateTime.fromISO(booking.booking_date).setZone(userTimezone);
      const key = bookingDateTime.toFormat('yyyy-MM-dd-HH');
      bookedSlotsMap.set(key, true);
    });

    const slots: TimeSlot[] = [];

    // Rango reducido - solo generamos slots para el día seleccionado
    // En lugar de iterar sobre 72 horas (3 días), solo iteramos sobre 24 horas (1 día)
    for (let hour = 0; hour < 24; hour++) {
      const userSlotDateTime = userDateTime.plus({ hours: hour });
      const utcSlotDateTime = userSlotDateTime.toUTC();
      const coachSlotDateTime = utcSlotDateTime.setZone(COACH_TIMEZONE);
      
      const coachHour = coachSlotDateTime.hour;
      
      // Verificar si es horario de trabajo del coach (1-4 AM o 12-4 PM)
      if ((coachHour >= 1 && coachHour <= 4) || (coachHour >= 12 && coachHour <= 16)) {
        // Solo añadir slots futuros y nunca del día actual en zona horaria del coach
        const nowInCoachTimezone = DateTime.now().setZone(COACH_TIMEZONE);
        const slotCoachDate = coachSlotDateTime.startOf('day');
        const todayInCoachTimezone = nowInCoachTimezone.startOf('day');
        
        // Saltamos slots del día actual en la zona horaria del coach
        if (slotCoachDate > todayInCoachTimezone && userSlotDateTime >= DateTime.now().setZone(userTimezone)) {
          // Verificar si el slot ya está reservado usando el mapa
          const slotKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH');
          const isBooked = bookedSlotsMap.has(slotKey);

          slots.push({
            id: `${userDateTime.toFormat('yyyy-MM-dd')}-${coachHour}`,
            date: userSlotDateTime.toJSDate(),
            available: !isBooked,
            utcDate: utcSlotDateTime.toJSDate()
          });
        }
      }
    }

    // Agrupar slots por día
    const dailyGroups = [{
      date: userDateTime.toJSDate(),
      slots: slots
    }];

    // Al final, guardar los resultados en caché
    const result = dailyGroups;
    cache.availableSlots.set(cacheKey, {data: result, timestamp: Date.now()});
    return result;
  },

  createBooking: async (
    email: string, 
    startDate: Date, 
    frequency: BookingFrequency,
    endDate: Date | null,
    duration: number,
    orderId?: string,
    secondDate?: Date,
    meetLink?: string
  ) => {
    try {
      // Convertir las fechas a UTC
      const startDateTime = DateTime.fromJSDate(startDate).toUTC();
      
      // Si es una reunión de tipo 'once', end_date es igual a booking_date
      const endDateTime = frequency === 'once' 
        ? startDateTime 
        : endDate ? DateTime.fromJSDate(endDate).toUTC() : null;

      // Crear la reserva principal sin order_id inicialmente
      const mainBooking = {
        user_email: email,
        frequency,
        booking_date: startDateTime.toJSDate(),
        end_date: endDateTime?.toJSDate() || null,
        duration,
        recurring_day: frequency !== 'once' ? DateTime.fromJSDate(startDate).weekdayLong : null,
        recurring_time: frequency !== 'once' ? startDateTime.toFormat('HH:mm') : null,
        // Solo incluimos order_id si se proporciona
        ...orderId ? { order_id: orderId } : {},  
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

  updateBookingWithOrderId: async (bookingId: string, orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('meetings_bookings')
        .update({ order_id: orderId })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Update booking with orderId error:', error);
      throw error;
    }
  },

  getFullyBookedDates: async (month: Date): Promise<Array<{ date: Date, fullyBooked: boolean }>> => {
    // Verificar si tenemos las fechas reservadas en caché
    if (cache.bookedDates.data && cache.isValid(cache.bookedDates.timestamp)) {
      return cache.bookedDates.data;
    }
    
    const startOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth(), 1)).startOf('day');
    const endOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)).endOf('day');
    
    const { data: bookings } = await supabase
      .from('meetings_bookings')
      .select(`
        booking_date, 
        frequency, 
        recurring_day, 
        recurring_time, 
        end_date,
        order_id,
        payments_status!inner (
          status
        )
      `)
      .or(`frequency.eq.once,frequency.neq.once`)
      .gte('booking_date', startOfMonth.toISO())
      .lte('booking_date', endOfMonth.toISO())
      .in('payments_status.status', ['PAID', 'ACTIVE']);

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
    const result = Array.from(bookingsByDate.entries())
      .filter(([_, count]) => count >= TOTAL_SLOTS_PER_DAY)
      .map(([dateStr, _]) => ({
        date: DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate(),
        fullyBooked: true
      }));
    /* eslint-enable @typescript-eslint/no-unused-vars */
    
    // Al final, guardar los resultados en caché
    cache.bookedDates = {data: result, timestamp: Date.now()};
    return result;
  }
}