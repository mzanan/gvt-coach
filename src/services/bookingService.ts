import { DateTime } from 'luxon'
import { supabase } from '@/lib/supabase/client'
import { BookingDB } from '@/types/booking'
import { GroupedTimeSlots, TimeSlot } from '@/types/booking'
import { BookingFrequency } from '@/types/enums'
import { CoachId, COACHES_CONFIG } from '@/config/coaches'

const cache = {
  availableSlots: new Map<string, GroupedTimeSlots[]>(),
  bookedDates: { data: null as Array<{ date: Date, fullyBooked: boolean }> | null },
  bookings: new Map<string, BookingDB>(),
  
  clearAvailableSlots: function() {
    this.availableSlots.clear();
  },
  
  clearBookedDates: function() {
    this.bookedDates = { data: null };
  }
};

export const bookingService = {
  getAvailableSlots: async (date: Date, userTimezone: string, coach: CoachId): Promise<GroupedTimeSlots[]> => {
    // Cache key using date and timezone
    const dateString = DateTime.fromJSDate(date).setZone(userTimezone).startOf('day').toFormat('yyyy-MM-dd');
    const cacheKey = `slots-${dateString}-${userTimezone}-${coach}`;
    
    // Check if we have available slots in cache
    const cachedSlots = cache.availableSlots.get(cacheKey);
    if (cachedSlots) {
      return cachedSlots;
    }
    
    // Get the selected coach configuration
    const coachConfig = COACHES_CONFIG[coach];
    const COACH_TIMEZONE = coachConfig.timezone;
    const COACH_MORNING_HOURS_START = coachConfig.workingHours.morning.start;
    const COACH_MORNING_HOURS_END = coachConfig.workingHours.morning.end;
    const COACH_AFTERNOON_HOURS_START = coachConfig.workingHours.afternoon.start;
    const COACH_AFTERNOON_HOURS_END = coachConfig.workingHours.afternoon.end;
    
    // Get the selected day in user timezone
    const userDateTime = DateTime.fromJSDate(date)
      .setZone(userTimezone)
      .startOf('day');
    
    // Get this day in coach timezone
    const coachDateTime = userDateTime.setZone(COACH_TIMEZONE);
    
    // Fetch bookings for this day in user's timezone
    const utcStartOfDay = userDateTime.toUTC();
    const utcEndOfDay = userDateTime.plus({ days: 1 }).toUTC();
    
    // Optimize queries - pre-create OR condition for better performance
    const dateCondition = `booking_date.gte.${utcStartOfDay.toISO()},booking_date.lt.${utcEndOfDay.toISO()}`;
    
    // Fetch bookings
    const [mainBookingsResult] = await Promise.all([
      supabase
        .from('gvt_coach_meetings_bookings')
        .select(`
          booking_date, 
          recurring_time,
          id,
          checkout_order_id
        `)
        .or(dateCondition),
    ]);
    
    let mainBookings = mainBookingsResult.data || [];
    const secondaryBookings: { booking_date: string; recurring_time: string }[] = [];
    
    // Filter bookings by payment status
    if (mainBookings.length > 0) {
      const bookingsWithOrderId = mainBookings.filter(b => b.checkout_order_id);
      
      if (bookingsWithOrderId.length > 0) {
        const orderIds = bookingsWithOrderId.map(b => b.checkout_order_id);
        
        const { data: checkoutMappings } = await supabase
          .from('gvt_coach_checkout_mapping')
          .select('checkout_order_id, payment_status_id')
          .in('checkout_order_id', orderIds);
        
        if (checkoutMappings && checkoutMappings.length > 0) {
          const paymentStatusIds = checkoutMappings
            .filter(mapping => mapping.payment_status_id)
            .map(mapping => mapping.payment_status_id);
          
          if (paymentStatusIds.length > 0) {
            const { data: paymentStatuses } = await supabase
              .from('gvt_coach_payments_status')
              .select('id, status')
              .in('id', paymentStatusIds)
              .eq('status', 'PAID');
          
            if (paymentStatuses && paymentStatuses.length > 0) {
              const paidStatusIds = new Set(paymentStatuses.map(ps => ps.id));
              
              const paidOrderIds = new Set(
                checkoutMappings
                  .filter(mapping => mapping.payment_status_id && paidStatusIds.has(mapping.payment_status_id))
                  .map(mapping => mapping.checkout_order_id)
              );
              
              mainBookings = mainBookings.filter(booking => 
                booking.checkout_order_id && paidOrderIds.has(booking.checkout_order_id)
              );
            } else {
              mainBookings = [];
            }
          }
        }
      }
    }
    
    // Map to store booked slots
    const bookedSlotsMap = new Map();
    
    // Define coach working hours
    const morningStart = COACH_MORNING_HOURS_START;
    const morningEnd = COACH_MORNING_HOURS_END;
    const afternoonStart = COACH_AFTERNOON_HOURS_START;
    const afternoonEnd = COACH_AFTERNOON_HOURS_END;
    
    const slots: TimeSlot[] = [];
    const now = DateTime.now().setZone(userTimezone);
    
    // Examinar el día seleccionado por el usuario y el día siguiente en la timezone del coach
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      // Día actual en la timezone del coach (puede ser el mismo día o el siguiente)
      const currentCoachDay = coachDateTime.plus({ days: dayOffset });
      
      // Verificar slots para este día del coach
      for (let hour = 0; hour < 24; hour++) {
        // Crear datetime en la timezone del COACH primero
        const coachSlotDateTime = currentCoachDay.set({ hour });
        
        // Convertir la hora del slot a UTC para comparar con las horas de trabajo UTC
        const coachSlotUTC = coachSlotDateTime.toUTC();
        const coachHourUTC = coachSlotUTC.hour;

        // Verificar si la HORA UTC del slot está dentro del horario laboral UTC del coach
        const isInMorningShift = (coachHourUTC >= morningStart && coachHourUTC <= morningEnd); // Incluir la hora final
        const isInAfternoonShift = (coachHourUTC >= afternoonStart && coachHourUTC <= afternoonEnd); // Incluir la hora final
        
        // Solo procesar si está dentro del horario laboral
        if (isInMorningShift || isInAfternoonShift) {
          // Convertir el slot (que está en la zona del coach) a la timezone del USUARIO para mostrar
          const userSlotDateTime = coachSlotDateTime.setZone(userTimezone);
          
          // CRUCIAL: Verificar si este slot convertido cae en el día seleccionado por el usuario
          const isInSelectedUserDay = userSlotDateTime.hasSame(userDateTime, 'day');
          
          // Solo agregar si el slot cae en el día que el usuario seleccionó
          if (isInSelectedUserDay) {
            // Verificar si el slot (en la zona del usuario) ya pasó
            if (userSlotDateTime < now) {
              continue; // Saltar horas pasadas
            }
            
            // Get UTC version of slot for storage (puede ser coachSlotUTC)
            const utcSlotDateTime = coachSlotUTC;
            
            // Format keys for checking bookings (usar la hora del usuario)
            const hourKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH');
            const exactKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH-mm');
            
            // Check bookings
            const isBooked = bookedSlotsMap.has(hourKey) || bookedSlotsMap.has(exactKey);
            
            // Add valid slot (con la fecha/hora convertida a la zona del usuario)
            slots.push({
              id: `${userDateTime.toFormat('yyyy-MM-dd')}-${userSlotDateTime.hour}`,
              date: userSlotDateTime.toJSDate(), // Este es el Date que se enviará al frontend
              available: !isBooked,
              utcDate: utcSlotDateTime.toJSDate()
            });
          }
        }
      }
    }
    
    // Mark which slots are booked
    [...mainBookings, ...secondaryBookings].forEach(booking => {
      try {
        // Use UTC time for booking key generation
        const bookingDateTimeUTC = DateTime.fromISO(booking.booking_date);
        const hourKeyUTC = bookingDateTimeUTC.toFormat('yyyy-MM-dd-HH');
        const exactKeyUTC = bookingDateTimeUTC.toFormat('yyyy-MM-dd-HH-mm');
        
        // Mark as booked
        bookedSlotsMap.set(exactKeyUTC, true);
        bookedSlotsMap.set(hourKeyUTC, true);
        
        // Update availability of affected slots
        slots.forEach(slot => {
          // Use UTC time for slot key generation
          const slotDateTimeUTC = DateTime.fromJSDate(slot.utcDate);
          const slotKeyUTC = slotDateTimeUTC.toFormat('yyyy-MM-dd-HH');
          
          // Compare UTC keys
          if (slotKeyUTC === hourKeyUTC) {
            slot.available = false;
          }
        });
      } catch (error) {
        console.error('Error processing booking date:', booking.booking_date, error);
      }
    });
    
    // Group slots by day (should be just one day)
    const dailyGroups = [{
      date: userDateTime.toJSDate(),
      slots: slots
    }];
    
    // Save in cache and return
    cache.availableSlots.set(cacheKey, dailyGroups);
    return dailyGroups;
  },

  getFullyBookedDates: async (month: Date): Promise<Array<{ date: Date, fullyBooked: boolean }>> => {
    // Check if we have the booked dates in cache
    if (cache.bookedDates.data) {
      return cache.bookedDates.data;
    }
    
    const startOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth(), 1)).startOf('day');
    const endOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)).endOf('day');
    
    const { data: bookings } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select(`
        id,
        booking_date, 
        frequency, 
        duration,
        user_email,
        meet_link,
        recurring_day, 
        recurring_time, 
        end_date,
        checkout_order_id
      `)
      .or(`frequency.eq.once,frequency.neq.once`)
      .gte('booking_date', startOfMonth.toISO())
      .lte('booking_date', endOfMonth.toISO());

    if (!bookings) {
      throw new Error('Failed to fetch bookings');
    }

    // Get payment statuses
    const orderIds = bookings.map(booking => booking.checkout_order_id).filter(Boolean);
    
    let validBookings = bookings;
    
    if (orderIds.length > 0) {
      // The previous query tried to get checkout_order_id from gvt_coach_payments_status, which is incorrect
      // First, get the mappings that contain payment_status_id for the checkout_order_id we have
      const { data: checkoutMappings } = await supabase
        .from('gvt_coach_checkout_mapping')
        .select('checkout_order_id, payment_status_id')
        .in('checkout_order_id', orderIds);
      
      if (checkoutMappings && checkoutMappings.length > 0) {
        // Then, get the payment statuses using payment_status_id
        const paymentStatusIds = checkoutMappings.map(mapping => mapping.payment_status_id).filter(Boolean);
        
        const { data: paymentStatuses } = await supabase
          .from('gvt_coach_payments_status')
          .select('id, status')
          .in('id', paymentStatusIds)
          .eq('status', 'PAID');
        
        if (paymentStatuses) {
          // Create a set of payment_status_id that have PAID status
          const paidStatusIds = new Set(paymentStatuses.map(ps => ps.id));
          
          // Filter checkout_order_id that have a payment_status_id with PAID status
          const validOrderIds = new Set(
            checkoutMappings
              .filter(mapping => mapping.payment_status_id && paidStatusIds.has(mapping.payment_status_id))
              .map(mapping => mapping.checkout_order_id)
          );
          
          validBookings = bookings.filter(booking => 
            booking.checkout_order_id && validOrderIds.has(booking.checkout_order_id)
          );
        }
      }
    }

    const singleBookings = validBookings.filter(b => b.frequency === BookingFrequency.Once);
    const recurringBookings = validBookings.filter(b => b.frequency !== BookingFrequency.Once);

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

    const result = Array.from(bookingsByDate.entries())
      .filter(([, count]) => count >= TOTAL_SLOTS_PER_DAY)
      .map(([dateStr]) => ({
        date: DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate(),
        fullyBooked: true
      }));
    
    // Finally, save the results in cache
    cache.bookedDates = {data: result};
    return result;
  },

  clearTimeSlotsCache: () => {
    cache.clearAvailableSlots();
    cache.clearBookedDates();
    console.log('Time slots cache cleared');
    return true;
  }
}