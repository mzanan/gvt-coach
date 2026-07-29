import { DateTime } from 'luxon'
import { BookingDB } from '@/types/booking'
import { GroupedTimeSlots, TimeSlot } from '@/types/booking'
import { CoachId, COACHES_CONFIG } from '@/config/coaches'
import { CoachConfig } from '@/types/coach'

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

async function fetchPaidBookings(startIso: string, endIso: string, coach?: CoachId): Promise<BookingDB[]> {
  const coachParam = coach ? `&coach=${encodeURIComponent(coach)}` : '';
  const response = await fetch(`/api/bookings/paid?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}${coachParam}`);
  if (!response.ok) {
    throw new Error('Could not load booked slots. Please try again.');
  }
  return response.json();
}

export const bookingService = {
  getAvailableSlots: async (date: Date, userTimezone: string, coach: CoachId, coachConfigOverride?: CoachConfig): Promise<GroupedTimeSlots[]> => {
    const dateString = DateTime.fromJSDate(date).setZone(userTimezone).startOf('day').toFormat('yyyy-MM-dd');
    const cacheKey = `slots-${dateString}-${userTimezone}-${coach}`;

    const cachedSlots = cache.availableSlots.get(cacheKey);
    if (cachedSlots) {
      return cachedSlots;
    }

    const coachConfig = coachConfigOverride || COACHES_CONFIG[coach];
    const COACH_TIMEZONE = coachConfig.timezone;
    const morningStart = coachConfig.workingHours.morning.start;
    const morningEnd = coachConfig.workingHours.morning.end;
    const afternoonStart = coachConfig.workingHours.afternoon.start;
    const afternoonEnd = coachConfig.workingHours.afternoon.end;

    const userDateTime = DateTime.fromJSDate(date)
      .setZone(userTimezone)
      .startOf('day');

    const coachDateTime = userDateTime.setZone(COACH_TIMEZONE);

    const utcStartOfDay = userDateTime.toUTC();
    const utcEndOfDay = userDateTime.plus({ days: 1 }).toUTC();

    const mainBookings = await fetchPaidBookings(utcStartOfDay.toISO() as string, utcEndOfDay.toISO() as string, coach);

    const bookedSlotsMap = new Map();

    const slots: TimeSlot[] = [];
    const now = DateTime.now().setZone(userTimezone);

    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const currentCoachDay = coachDateTime.plus({ days: dayOffset });

      for (let hour = 0; hour < 24; hour++) {
        const coachSlotDateTime = currentCoachDay.set({ hour });

        const coachSlotUTC = coachSlotDateTime.toUTC();
        const coachHourUTC = coachSlotUTC.hour;

        const isInMorningShift = (coachHourUTC >= morningStart && coachHourUTC <= morningEnd);
        const isInAfternoonShift = (coachHourUTC >= afternoonStart && coachHourUTC <= afternoonEnd);

        if (isInMorningShift || isInAfternoonShift) {
          const userSlotDateTime = coachSlotDateTime.setZone(userTimezone);

          const isInSelectedUserDay = userSlotDateTime.hasSame(userDateTime, 'day');

          if (isInSelectedUserDay) {
            if (userSlotDateTime < now) {
              continue;
            }

            const utcSlotDateTime = coachSlotUTC;

            const hourKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH');
            const exactKey = userSlotDateTime.toFormat('yyyy-MM-dd-HH-mm');

            const isBooked = bookedSlotsMap.has(hourKey) || bookedSlotsMap.has(exactKey);

            slots.push({
              id: `${userDateTime.toFormat('yyyy-MM-dd')}-${userSlotDateTime.hour}`,
              date: userSlotDateTime.toJSDate(),
              available: !isBooked,
              utcDate: utcSlotDateTime.toJSDate()
            });
          }
        }
      }
    }

    mainBookings.forEach(booking => {
      try {
        const bookingDateTimeUTC = DateTime.fromISO(booking.booking_date);
        const hourKeyUTC = bookingDateTimeUTC.toFormat('yyyy-MM-dd-HH');
        const exactKeyUTC = bookingDateTimeUTC.toFormat('yyyy-MM-dd-HH-mm');

        bookedSlotsMap.set(exactKeyUTC, true);
        bookedSlotsMap.set(hourKeyUTC, true);

        slots.forEach(slot => {
          const slotDateTimeUTC = DateTime.fromJSDate(slot.utcDate);
          const slotKeyUTC = slotDateTimeUTC.toFormat('yyyy-MM-dd-HH');

          if (slotKeyUTC === hourKeyUTC) {
            slot.available = false;
          }
        });
      } catch (error) {
        console.error('Error processing booking date:', booking.booking_date, error);
      }
    });

    const dailyGroups = [{
      date: userDateTime.toJSDate(),
      slots: slots
    }];

    cache.availableSlots.set(cacheKey, dailyGroups);
    return dailyGroups;
  },

  getFullyBookedDates: async (month: Date): Promise<Array<{ date: Date, fullyBooked: boolean }>> => {
    if (cache.bookedDates.data) {
      return cache.bookedDates.data;
    }

    const startOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth(), 1)).startOf('day');
    const endOfMonth = DateTime.fromJSDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)).endOf('day');

    const validBookings = await fetchPaidBookings(startOfMonth.toISO() as string, endOfMonth.toISO() as string);

    const bookingsByDate = new Map<string, number>();
    const TOTAL_SLOTS_PER_DAY = 9;

    validBookings.forEach(booking => {
      try {
        const dateStr = DateTime.fromISO(booking.booking_date).toFormat('yyyy-MM-dd');
        bookingsByDate.set(dateStr, (bookingsByDate.get(dateStr) || 0) + 1);
      } catch (e) {
        console.error('Error parsing booking date in count:', booking.booking_date, e);
      }
    });

    const fullyBookedDates: Array<{ date: Date, fullyBooked: boolean }> = [];

    for (let d = startOfMonth; d <= endOfMonth; d = d.plus({ days: 1 })) {
      const dateStr = d.toFormat('yyyy-MM-dd');
      const currentCount = bookingsByDate.get(dateStr) || 0;

      fullyBookedDates.push({
        date: d.toJSDate(),
        fullyBooked: currentCount >= TOTAL_SLOTS_PER_DAY
      });
    }

    cache.bookedDates = { data: fullyBookedDates };
    return fullyBookedDates;
  },

  clearTimeSlotsCache: () => {
    cache.clearAvailableSlots();
    cache.clearBookedDates();
    return true;
  }
}
