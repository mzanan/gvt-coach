'use client'

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { TimeSlot, BookingPlan, DayGroup } from '@/types/booking'
import { DateTime } from 'luxon'
import { bookingService } from '@/services/bookingService'
import { getPaymentService } from '@/services/payments'
import { BookingFrequency } from '@/types/enums'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'
import { setClientCookie, setTimezoneCookie, getTimezoneCookie } from '@/lib/utils/cookies'
import { isValidEmail } from '@/lib/utils'
import { userService } from '@/services/userService'
import { useToast } from '@/app/components/ui-kit/use-toast'
import type { CoachId } from "@/config/coaches"
import { DEFAULT_TIMEZONE } from '@/config/site'
import { UserProfile } from '@/types/user'

interface Section {
  id: 'coach' | 'date' | 'time' | 'summary'
  title: string
  completed: boolean
}

export function useBookingCalendar() {
  const { toast } = useToast()
  const { coaches } = useAppConfig()
  const [sections, setSections] = useState<Section[]>([
    { id: 'coach', title: 'Select Coach', completed: false },
    { id: 'date', title: 'Select Date', completed: false },
    { id: 'time', title: 'Select Time', completed: false },
    { id: 'summary', title: 'Booking Summary', completed: false }
  ])
  const [activeSection, setActiveSection] = useState<string>('coach')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [availableSlots, setAvailableSlots] = useState<DayGroup[]>([])
  const [bookingPlan, setBookingPlan] = useState<BookingPlan>({
    frequency: BookingFrequency.Once,
    duration: 1
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [bookedDates, setBookedDates] = useState<Array<{ date: Date, fullyBooked: boolean }>>([])
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const latestSlotsRequestRef = useRef(0)
  const [userEmail, setUserEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isEditingEmail, setIsEditingEmail] = useState(false)

  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (document.cookie.includes('user_timezone=')) {
        document.cookie = 'user_timezone=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
      }

      const cookieTimezone = getTimezoneCookie();

      if (cookieTimezone) {
        return cookieTimezone;
      }

      const profileTimezone = userProfile?.timezone;

      if (profileTimezone) {
        setTimezoneCookie(profileTimezone);
        return profileTimezone;
      }

      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      setTimezoneCookie(detectedTimezone);
      return detectedTimezone;
    }
    return DEFAULT_TIMEZONE;
  });

  useEffect(() => {
    let ignore = false;

    const loadUserData = async () => {
      try {
        const userData = await userService.getUserFromAuthUsers();
        if (!userData || ignore) return;

        const userProfileData: UserProfile = {
          id: String(userData.id ?? ''),
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: '',
          timezone: userData.timezone,
          full_name: `${userData.first_name} ${userData.last_name}`
        };

        setUserProfile(userProfileData);

        if (userData.email) {
          setUserEmail(prev => prev || userData.email);
        }
      } catch {
        if (!ignore) {
          toast({
            title: "Error",
            description: "Could not load user data.",
            variant: "destructive"
          });
        }
      }
    };

    loadUserData();

    return () => {
      ignore = true;
    };
  }, [toast]);

  useEffect(() => {
    let ignore = false;

    bookingService.getFullyBookedDates(new Date())
      .then(dates => {
        if (!ignore) setBookedDates(dates);
      })
      .catch(() => console.error("Error fetching booked dates"));

    return () => {
      ignore = true;
    };
  }, []);

  const fetchAvailableSlots = useCallback(async (date: Date, timezone: string, coach: CoachId) => {
    const requestId = ++latestSlotsRequestRef.current;

    try {
      setIsLoadingSlots(true);
      const groupedSlots = await bookingService.getAvailableSlots(
        date,
        timezone,
        coach,
        coaches[coach]
      );

      if (requestId !== latestSlotsRequestRef.current) return;

      setAvailableSlots(groupedSlots);

    } catch (error: unknown) {
      if (requestId !== latestSlotsRequestRef.current) return;

      console.error('Error fetching available slots:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch available time slots. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      if (requestId === latestSlotsRequestRef.current) {
        setIsLoadingSlots(false);
      }
    }
  }, [toast, setIsLoadingSlots, coaches]);

  const handleTimezoneChange = useCallback((timezone: string) => {
    latestSlotsRequestRef.current += 1;
    setIsLoadingSlots(false);
    setSelectedTimezone(timezone);
    setTimezoneCookie(timezone);

    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]);

    setBookingPlan(prev => ({
      ...prev,
      frequency: BookingFrequency.Once,
      duration: 1
    }));

    setSections(prev => prev.map(s => {
      if (s.id === 'date') return { ...s, completed: false };
      if (s.id === 'time') return { ...s, completed: false };
      if (s.id === 'summary') return { ...s, completed: false };
      return s;
    }));

    setEmailError(null);
    setIsEditingEmail(false);
    setActiveSection(bookingPlan.coach ? 'date' : 'coach');

    toast({
      title: "Timezone Updated",
      description: `Your timezone has been updated to ${timezone}.`,
    });
  }, [toast, bookingPlan.coach]);

  const handleDateSelect = useCallback(async (date: Date) => {
    if (!bookingPlan.coach) return;

    const selectedLocalDate = DateTime.fromJSDate(date).startOf('day').setZone(selectedTimezone, { keepLocalTime: true });

    const isSameDay = selectedDate
      ? DateTime.fromJSDate(selectedDate).setZone(selectedTimezone).hasSame(selectedLocalDate, 'day')
      : false;

    if (isSameDay) return;

    setIsLoadingSlots(true);
    setSelectedDate(selectedLocalDate.toJSDate());
    setSelectedSlot(null);

    try {
      setSections(prev => prev.map(s => {
        if (s.id === 'date') return { ...s, completed: true };
        if (s.id === 'time') return { ...s, completed: false };
        if (s.id === 'summary') return { ...s, completed: false };
        return s;
      }));
      setActiveSection('time');

      fetchAvailableSlots(
        selectedLocalDate.toJSDate(),
        selectedTimezone,
        bookingPlan.coach
      );
    } catch (error: unknown) {
      console.error('Error loading slots:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load available time slots. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [selectedTimezone, bookingPlan, selectedDate, fetchAvailableSlots, setSections, setActiveSection, toast, setIsLoadingSlots, setSelectedDate, setSelectedSlot]);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    if (!slot.available || !slot.date) {
      toast({
        title: "Error",
        description: "The selected time slot is invalid. Please try another one.",
        variant: "destructive"
      });
      return;
    }

    const slotDateTime = DateTime.fromJSDate(slot.date).setZone(selectedTimezone);
    const slotUTC = slotDateTime.toUTC();

    const correctedSlot = {
      ...slot,
      date: slotDateTime.toJSDate(),
      utcDate: slotUTC.toJSDate()
    };

    setBookingPlan(prev => ({
      ...prev,
      firstSlot: correctedSlot,
      duration: 1,
      frequency: BookingFrequency.Once
    }));

    setSelectedSlot(correctedSlot);

    setSections(prev => prev.map(s =>
      s.id === 'time' ? { ...s, completed: true } : s
    ));
    setActiveSection('summary');
  }, [selectedTimezone, setBookingPlan, setSelectedSlot, setSections, setActiveSection, toast]);

  const handleSectionClick = useCallback((sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);

    const previousSectionsCompleted = sections
      .slice(0, sectionIndex)
      .every(s => s.completed);

    if (previousSectionsCompleted) {
      setActiveSection(sectionId);
    }
  }, [sections, setActiveSection]);

  const handleCoachSelect = useCallback((coach: CoachId) => {
    latestSlotsRequestRef.current += 1;
    setBookingPlan(prev => ({
      ...prev,
      coach,
      frequency: BookingFrequency.Once
    }));

    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]);

    setSections(prev => prev.map(s => {
      if (s.id === 'coach') return { ...s, completed: true };
      if (s.id === 'date') return { ...s, completed: false };
      if (s.id === 'time') return { ...s, completed: false };
      if (s.id === 'summary') return { ...s, completed: false };
      return s;
    }));
    setActiveSection('date');
  }, []);

  const formatSlotTime = useCallback((date: Date) => {
    const dtUserLocal = DateTime.fromJSDate(date, { zone: selectedTimezone });
    return dtUserLocal.toFormat('h:mm a');
  }, [selectedTimezone]);

  const handleEmailChange = useCallback((value: string) => {
    setUserEmail(value);

    if (emailError && isValidEmail(value)) {
      setEmailError(null);
    }
  }, [emailError]);

  const handleEmailEditToggle = useCallback(() => {
    if (!isEditingEmail) {
      setIsEditingEmail(true);
      return;
    }

    if (!isValidEmail(userEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setUserEmail(userEmail.trim());
    setEmailError(null);
    setIsEditingEmail(false);
  }, [isEditingEmail, userEmail]);

  const isEmailValid = isValidEmail(userEmail);

  const handleEmailKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEmailEditToggle();
    }
  }, [handleEmailEditToggle]);

  const handleBookingConfirm = useCallback(async () => {
    const email = userEmail.trim();

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      setIsEditingEmail(true);
      return;
    }

    setIsBookingLoading(true);

    try {
      if (!selectedSlot) {
        throw new Error("No time slot was selected");
      }

      const localDateTime = DateTime.fromJSDate(selectedSlot.date).setZone(selectedTimezone);
      const utcDateTime = localDateTime.toUTC();

      const updatedBookingPlan = {
        ...bookingPlan,
        firstSlot: selectedSlot,
        duration: bookingPlan?.duration || 1,
        frequency: bookingPlan?.frequency || BookingFrequency.Once
      };

      const profileWithEmail = { ...userProfile, email } as UserProfile;
      setClientCookie('user_email', email);

      const coachProvider = updatedBookingPlan.coach ? coaches[updatedBookingPlan.coach]?.paymentProvider : undefined;

      const { checkoutUrl, orderId } = await getPaymentService(coachProvider).createCheckout(
        updatedBookingPlan,
        profileWithEmail,
        true
      );

      if (!orderId || !checkoutUrl) {
        throw new Error('Error creating checkout: missing orderId or checkoutUrl');
      }

      const tempBookingData = {
        userEmail: email,
        bookingPlan: updatedBookingPlan,
        selectedDate: localDateTime.toISO(),
        utcDate: utcDateTime.toISO(),
        selectedTimezone: selectedTimezone
      };

      setClientCookie('pending_booking', tempBookingData);

      window.location.href = checkoutUrl;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error creating booking.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsBookingLoading(false);
    }
  }, [bookingPlan, selectedSlot, userProfile, selectedTimezone, toast, coaches, userEmail]);

  const handleNextSection = useCallback(() => {
    const activeIndex = sections.findIndex(s => s.id === activeSection);
    if (activeIndex < sections.length - 1) {
      const nextSection = sections[activeIndex + 1].id;
      setActiveSection(nextSection);
    }
  }, [activeSection, sections]);

  return {
    sections,
    activeSection,
    selectedDate,
    selectedSlot,
    availableSlots,
    bookingPlan,
    userProfile,
    bookedDates,
    isBookingLoading,
    isLoadingSlots,
    selectedTimezone,
    userEmail,
    setUserEmail,
    emailError,
    isEmailValid,
    isEditingEmail,
    handleEmailChange,
    handleEmailEditToggle,
    handleEmailKeyDown,
    handleTimezoneChange,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleCoachSelect,
    formatSlotTime,
    handleBookingConfirm,
    handleNextSection,
    fetchAvailableSlots
  }
}

export type BookingCalendarHook = ReturnType<typeof useBookingCalendar>;
