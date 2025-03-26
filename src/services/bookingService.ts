import { DateTime } from 'luxon'
import { supabase, getToken } from '@/lib/supabase/client'
import { UserProfile } from '@/app/types/user'
import { BookingDB } from '@/app/types/booking'
import { GroupedTimeSlots, TimeSlot } from '@/app/types/booking'
import { BookingFrequency } from '@/app/types/enums/booking'

const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC';

// Cache to store results and reduce unnecessary calls
const cache = {
  availableSlots: new Map<string, GroupedTimeSlots[]>(),
  bookedDates: { data: null as Array<{ date: Date, fullyBooked: boolean }> | null },
  bookings: new Map<string, BookingDB>(),
  
  clearAll: function() {
    this.availableSlots.clear();
    this.bookedDates = { data: null };
    this.bookings.clear();
  },
  
  clearAvailableSlots: function() {
    this.availableSlots.clear();
  },
  
  clearBookedDates: function() {
    this.bookedDates = { data: null };
  }
};

export const bookingService = {
  fetchBookingById: async (id: string): Promise<BookingDB> => {
    // Check if we have the booking in cache
    const cachedBooking = cache.bookings.get(id);
    if (cachedBooking) {
      return cachedBooking;
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
    
    if (mainBooking.frequency === BookingFrequency.TwiceWeekly) {
      const { data: secondBooking } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('user_email', mainBooking.user_email)
        .eq('frequency', BookingFrequency.TwiceWeekly)
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
        
        // Save to cache
        cache.bookings.set(id, result);
        return result;
      }
    }
    
    // Save to cache
    cache.bookings.set(id, mainBooking);
    return mainBooking
  },

  saveUserProfile: async (profile: UserProfile) => {
    // Implement a function to handle localStorage more securely
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
    
    // Save profile to localStorage
    saveToLocalStorage('userProfile', profile, 30 * 24 * 60 * 60 * 1000);

    // Also save to the database
    const { data, error } = await supabase
      .from('gvt_coach_user_profiles')
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

      // If the profile has expired, update the expiration time
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
    // Cache key using date and timezone - use only date without time for better caching
    const dateString = DateTime.fromJSDate(date).setZone(userTimezone).startOf('day').toFormat('yyyy-MM-dd');
    const cacheKey = `slots-${dateString}-${userTimezone}`;
    
    // Check if we have available slots in cache
    const cachedSlots = cache.availableSlots.get(cacheKey);
    if (cachedSlots) {
      console.log('Returning cached slots for', dateString);
      return cachedSlots;
    }
    
    // Add current time in the selected timezone for debugging
    const now = DateTime.now().setZone(userTimezone);
    console.log(`Fetching slots for ${dateString} - Current time in ${userTimezone}: ${now.toFormat('yyyy-MM-dd HH:mm:ss')}`);
    
    const userDateTime = DateTime.fromJSDate(date)
      .setZone(userTimezone)
      .startOf('day');
    
    const utcStartOfDay = userDateTime.minus({ days: 0 }).toUTC(); // Reduced from 1 to 0 days
    const utcEndOfDay = userDateTime.plus({ days: 1 }).toUTC(); // Reduced from 2 to 1 day
    
    // Optimize queries - pre-create OR condition for better performance
    const dateCondition = `booking_date.gte.${utcStartOfDay.toISO()},booking_date.lt.${utcEndOfDay.toISO()}`;
    
    // Optimize queries
    const [mainBookingsResult] = await Promise.all([
      // Get the bookings
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
    // Define the type explicitly to avoid type errors
    const secondaryBookings: { booking_date: string; recurring_time: string }[] = []; // Initialize empty since we're not using it yet
    
    // Filter bookings to include only those with confirmed payments (PAID)
    if (mainBookings.length > 0) {
      // Get the order IDs
      const orderIds = mainBookings
        .map(booking => booking.checkout_order_id)
        .filter(Boolean);
      
      if (orderIds.length > 0) {
        // Get the checkout_order_id to payment_status_id mappings
        const { data: checkoutMappings } = await supabase
          .from('gvt_coach_checkout_mapping')
          .select('checkout_order_id, payment_status_id')
          .in('checkout_order_id', orderIds);
        
        if (checkoutMappings && checkoutMappings.length > 0) {
          // Get the PAID payment statuses using payment_status_id
          const paymentStatusIds = checkoutMappings
            .map(mapping => mapping.payment_status_id)
            .filter(Boolean);
          
          const { data: paymentStatuses } = await supabase
            .from('gvt_coach_payments_status')
            .select('id, status')
            .in('id', paymentStatusIds)
            .eq('status', 'PAID');
          
          if (paymentStatuses && paymentStatuses.length > 0) {
            // Create a set of payment_status_id that have PAID status
            const paidStatusIds = new Set(paymentStatuses.map(ps => ps.id));
            
            // Create a set of checkout_order_id with PAID status
            const paidOrderIds = new Set(
              checkoutMappings
                .filter(mapping => mapping.payment_status_id && paidStatusIds.has(mapping.payment_status_id))
                .map(mapping => mapping.checkout_order_id)
            );
            
            // Filter bookings to include only those with confirmed payments
            mainBookings = mainBookings.filter(booking => 
              booking.checkout_order_id && paidOrderIds.has(booking.checkout_order_id)
            );
          } else {
            // If there are no PAID statuses, there are no valid bookings
            mainBookings = [];
          }
        }
      }
    }
    
    // Prepare a map for faster lookup of occupied slots
    const bookedSlotsMap = new Map();
    
    // First, determine valid coach hours for the day
    const validSlots = new Set<string>();
    for (let hour = 0; hour < 24; hour++) {
      const userSlotDateTime = userDateTime.plus({ hours: hour });
      const utcSlotDateTime = userSlotDateTime.toUTC();
      const coachSlotDateTime = utcSlotDateTime.setZone(COACH_TIMEZONE);
      
      const coachHour = coachSlotDateTime.hour;
      
      // Check if it's coach working hours (1-4 AM or 12-4 PM)
      if ((coachHour >= 1 && coachHour <= 4) || (coachHour >= 12 && coachHour <= 16)) {
        // Only add future slots and never from the current day in coach timezone
        const nowInCoachTimezone = DateTime.now().setZone(COACH_TIMEZONE);
        const slotCoachDate = coachSlotDateTime.startOf('day');
        const todayInCoachTimezone = nowInCoachTimezone.startOf('day');
        
        // Skip slots from the current day in coach timezone
        if (slotCoachDate > todayInCoachTimezone && userSlotDateTime >= DateTime.now().setZone(userTimezone)) {
          // Add the slot to valid slots
          const slotKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH');
          validSlots.add(slotKey);
        }
      }
    }
    
    // Only process bookings that fall within valid coach hours
    [...mainBookings, ...secondaryBookings].forEach(booking => {
      try {
        // Convert the UTC booking date to the user's timezone for accurate slot blocking
        const bookingDateTime = DateTime.fromISO(booking.booking_date).setZone(userTimezone);
        const slotKey = bookingDateTime.toFormat('yyyy-MM-dd-HH');
        
        // Only process if the booking is in a valid slot
        if (validSlots.has(slotKey)) {
          // Create multiple keys for better slot blocking - one for the exact hour and half-hour
          const keyFormat = 'yyyy-MM-dd-HH-mm';
          const exactKey = bookingDateTime.toFormat(keyFormat);
          
          // Block the whole hour for the booked slot
          const hourKey = bookingDateTime.startOf('hour').toFormat('yyyy-MM-dd-HH');
          
          // Also block the half-hour if applicable
          const minuteValue = bookingDateTime.minute;
          const halfHourKey = minuteValue < 30 
            ? bookingDateTime.set({ minute: 0 }).toFormat(keyFormat) 
            : bookingDateTime.set({ minute: 30 }).toFormat(keyFormat);
          
          console.log(`Marking slot as booked: ${booking.booking_date} => ${exactKey} (${userTimezone})`);
          
          // Mark all relevant keys as booked
          bookedSlotsMap.set(exactKey, true);
          bookedSlotsMap.set(hourKey, true);
          bookedSlotsMap.set(halfHourKey, true);
        }
      } catch (error) {
        console.error('Error processing booking date:', booking.booking_date, error);
      }
    });

    const slots: TimeSlot[] = [];

    // Generate slots using the same valid hours logic
    for (let hour = 0; hour < 24; hour++) {
      const userSlotDateTime = userDateTime.plus({ hours: hour });
      const utcSlotDateTime = userSlotDateTime.toUTC();
      const coachSlotDateTime = utcSlotDateTime.setZone(COACH_TIMEZONE);
      
      const coachHour = coachSlotDateTime.hour;
      
      // Check if it's coach working hours (1-4 AM or 12-4 PM)
      if ((coachHour >= 1 && coachHour <= 4) || (coachHour >= 12 && coachHour <= 16)) {
        // Only add future slots and never from the current day in coach timezone
        const nowInCoachTimezone = DateTime.now().setZone(COACH_TIMEZONE);
        const slotCoachDate = coachSlotDateTime.startOf('day');
        const todayInCoachTimezone = nowInCoachTimezone.startOf('day');
        
        // Skip slots from the current day in coach timezone
        if (slotCoachDate > todayInCoachTimezone && userSlotDateTime >= DateTime.now().setZone(userTimezone)) {
          // Check if the slot is already booked using the map
          const hourKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH');
          const exactKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH-mm');
          const isBooked = bookedSlotsMap.has(hourKey) || bookedSlotsMap.has(exactKey);

          slots.push({
            id: `${userDateTime.toFormat('yyyy-MM-dd')}-${coachHour}`,
            date: userSlotDateTime.toJSDate(),
            available: !isBooked,
            utcDate: utcSlotDateTime.toJSDate()
          });
        }
      }
    }

    // Group slots by day
    const dailyGroups = [{
      date: userDateTime.toJSDate(),
      slots: slots
    }];

    // Finally, save the results in cache
    const result = dailyGroups;
    cache.availableSlots.set(cacheKey, result);
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
      // Convert dates to UTC
      const startDateTime = DateTime.fromJSDate(startDate).toUTC();
      
      // If it's a 'once' meeting, end_date is equal to booking_date
      const endDateTime = frequency === BookingFrequency.Once
        ? startDateTime.plus({ minutes: session_minutes || duration * 60 })
        : null;

      // Create the main booking without checkout_order_id initially
      const mainBooking = {
        user_email: email,
        frequency,
        booking_date: startDateTime.toJSDate(),
        end_date: endDateTime?.toJSDate() || null,
        duration,
        recurring_day: frequency !== BookingFrequency.Once ? DateTime.fromJSDate(startDate).weekdayLong : null,
        recurring_time: frequency !== BookingFrequency.Once ? startDateTime.toFormat('HH:mm') : null,
        // Only include checkout_order_id if provided
        ...orderId ? { checkout_order_id: orderId } : {},  
        meet_link: meetLink
      };

      const { data: savedBooking, error } = await supabase
        .from('gvt_coach_meetings_bookings')
        .insert([mainBooking])
        .select()
        .single();

      if (error) throw error;

      // If it's twice-weekly, create the second session in UTC
      if (frequency === BookingFrequency.TwiceWeekly && secondDate) {
        const secondDateTime = DateTime.fromJSDate(secondDate).toUTC();
        const secondSession = {
          booking_id: savedBooking.id,
          booking_date: secondDateTime.toJSDate(),
          end_date: endDateTime?.toJSDate() || null,
          recurring_day: DateTime.fromJSDate(secondDate).weekdayLong,
          recurring_time: secondDateTime.toFormat('HH:mm')
        };

        const { error: secondError } = await supabase
          .from('gvt_coach_multiple_bookings')
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
        .from('gvt_coach_meetings_bookings')
        .update({ checkout_order_id: orderId })
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
      .filter(([_, count]) => count >= TOTAL_SLOTS_PER_DAY)
      .map(([dateStr, _]) => ({
        date: DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate(),
        fullyBooked: true
      }));
    /* eslint-enable @typescript-eslint/no-unused-vars */
    
    // Finally, save the results in cache
    cache.bookedDates = {data: result};
    return result;
  },

  async generateMeetLink(booking: BookingDB): Promise<string | null> {
    try {
      if (booking.meet_link) {
        console.log("Booking already has a meet link:", booking.meet_link);
        return booking.meet_link;
      }

      if (!booking.booking_date) {
        console.error("Cannot create meeting: booking_date is missing");
        return null;
      }

      const meetingTime = new Date(booking.booking_date);
      
      // Format the topic with user email
      const meetingTopic = `GVT Coaching Session with ${booking.user_email}`;
      
      // Default to 60 minutes if not specified
      const duration = booking.session_minutes || 60;
      
      const response = await fetch('/api/zoom/meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingTopic,
          meetingTime: meetingTime.toISOString(),
          duration,
          timezone: booking.user_timezone || 'UTC'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Zoom meeting');
      }

      const data = await response.json();
      
      if (data.join_url) {
        // Update the booking with the meeting link
        const { error } = await supabase
          .from('gvt_coach_meetings_bookings')
          .update({ meet_link: data.join_url })
          .eq('id', booking.id);
          
        if (error) {
          console.error("Error updating booking with meet link:", error);
        } else {
          console.log("Updated booking with meet link:", data.join_url);
        }
        
        return data.join_url;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating meeting link:', error);
      return null;
    }
  },

  clearTimeSlotsCache: () => {
    // Limpiar la caché de slots disponibles para forzar una recarga
    cache.clearAvailableSlots();
    cache.clearBookedDates();
    console.log('Time slots cache cleared');
    return true;
  },

  createSlots: (startHour = 8, endHour = 17, days = 7, userTimezone: string): GroupedTimeSlots[] => {
    // Add logging for debugging
    console.log(`Creating slots: startHour=${startHour}, endHour=${endHour}, userTimezone=${userTimezone}`);
    
    const now = DateTime.now().setZone(userTimezone);
    console.log(`Current time in ${userTimezone}: ${now.toFormat('yyyy-MM-dd HH:mm:ss')}`);
    
    const result: GroupedTimeSlots[] = [];
    const today = DateTime.now().setZone(userTimezone);
    
    for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
      const currentDay = today.plus({ days: dayOffset });
      const isWeekend = [6, 7].includes(currentDay.weekday);
      
      // Skip weekends
      if (isWeekend) continue;
      
      const slots: SlotInfo[] = [];
      
      // Create slots for each hour
      for (let hour = startHour; hour <= endHour; hour++) {
        for (const minute of [0, 30]) {
          // Create the date object with the correct time in the user's timezone
          const slotDateTime = currentDay.set({ 
            hour, 
            minute, 
            second: 0, 
            millisecond: 0 
          });
          
          // Generate a unique ID for this slot
          const slotId = slotDateTime.toMillis().toString();
          
          // Convert the slot to UTC for storage purposes
          const utcSlotDateTime = slotDateTime.toUTC();
          
          // Log the slots being created for debugging
          if (hour === 9 || hour === 10) { // Solo log de algunas horas para no saturar
            console.log(`Creating slot for ${slotDateTime.toFormat('yyyy-MM-dd HH:mm')} (${userTimezone}):`, {
              localTime: slotDateTime.toISO(),
              utcTime: utcSlotDateTime.toISO(),
              offset: slotDateTime.offset / 60 // en horas
            });
          }
          
          // Create the TimeSlot object with local date and UTC date
          const timeSlot: TimeSlot = {
            id: slotId,
            date: slotDateTime.toJSDate(),
            utcDate: utcSlotDateTime.toJSDate(),
            available: true
          };
          
          // Add to the list of slots
          slots.push({
            date: slotDateTime.toJSDate(),
            available: true,
            slot: timeSlot
          });
        }
      }
      
      if (slots.length > 0) {
        result.push({
          date: currentDay.toJSDate(),
          slots
        });
      }
    }
    
    return result;
  }
}