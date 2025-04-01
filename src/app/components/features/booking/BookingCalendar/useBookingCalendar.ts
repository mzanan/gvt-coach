'use client'

import { useState, useEffect, useCallback } from 'react'
import { TimeSlot, BookingPlan, DayGroup } from '@/types/booking'
import { DateTime } from 'luxon'
import { bookingService } from '@/services/bookingService'
import { paymentService } from '@/services/payments'
import { BookingFrequency } from '@/types/enums'
import { setClientCookie, setTimezoneCookie, getTimezoneCookie } from '@/lib/utils/cookies'
import { userService } from '@/services/userService'
import { useToast } from '@/app/components/ui-kit/use-toast'
import type { CoachId } from "@/config/coaches"
import { UserProfile } from '@/types/user'

interface Section {
  id: 'coach' | 'frequency' | 'date' | 'time' | 'summary'
  title: string
  completed: boolean
}

export function useBookingCalendar() {
  const { toast } = useToast()
  const [sections, setSections] = useState<Section[]>([
    { id: 'coach', title: 'Select Coach', completed: false },
    { id: 'frequency', title: 'Select Frequency', completed: false },
    { id: 'date', title: 'Select Date', completed: false },
    { id: 'time', title: 'Select Time', completed: false },
    { id: 'summary', title: 'Booking Summary', completed: false }
  ])
  const [activeSection, setActiveSection] = useState<string>('coach')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null)
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


  // Initialize with timezone from cookie or browser
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      // Clean up old user_timezone cookie if it exists
      if (document.cookie.includes('user_timezone=')) {
        document.cookie = 'user_timezone=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;';
      }
      
      // First check cookie
      const cookieTimezone = getTimezoneCookie();
      
      if (cookieTimezone) {
        return cookieTimezone;
      }
      
      // If no cookie, check cached profile
      const profileTimezone = userProfile?.timezone;
      
      if (profileTimezone) {
        setTimezoneCookie(profileTimezone); // Ensure cookie is set if profile had it
        return profileTimezone;
      }
      
      // Fallback to browser timezone
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Save detected timezone to cookie immediately
      setTimezoneCookie(detectedTimezone);
      return detectedTimezone;
    }
    return 'UTC'; // Default for server-side rendering
  });

  useEffect(() => {
    // Load user data from the service
    const loadUserData = async () => {
      try {
        const userData = await userService.getUserFromAuthUsers();
        if (userData) {
          const userProfileData: UserProfile = {
            id: userData.id || '',
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: '',
            timezone: userData.timezone,
            full_name: `${userData.first_name} ${userData.last_name}`
          };
          
          setUserProfile(userProfileData);
        }
      } catch {
        toast({
          title: "Error",
          description: "Could not load user data.",
          variant: "destructive"
        });
      }
    };
    
    loadUserData();
  }, [toast]);

  const loadBookedDates = useCallback(async () => {
    try {
      const dates = await bookingService.getFullyBookedDates(new Date());
      setBookedDates(dates);
    } catch {
      console.error("Error fetching booked dates");
    }
  }, []);

  useEffect(() => {
    loadBookedDates();
  }, [loadBookedDates]);

  // Define fetchAvailableSlots HERE, before handleDateSelect
  const fetchAvailableSlots = useCallback(async (date: Date, timezone: string, coach: CoachId) => {
    try {
      setIsLoadingSlots(true);
      // Call bookingService which now returns GroupedTimeSlots[] using TimeSlot[] directly
      const groupedSlots = await bookingService.getAvailableSlots(
        date,
        timezone,
        coach
      );
      
      setAvailableSlots(groupedSlots);

    } catch (error: unknown) {
      console.error('Error fetching available slots:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch available time slots. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [toast, setIsLoadingSlots]); 


  const handleTimezoneChange = useCallback((timezone: string) => {
    setSelectedTimezone(timezone);
    setTimezoneCookie(timezone);
    
    setSelectedDate(null);
    setSuggestedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
    
    setBookingPlan(prev => ({
      ...prev,
      coach: prev?.coach as CoachId || 'MATIAS',
      frequency: BookingFrequency.Once,
      duration: 1 
    }));
    
    // Make coach and date sections available, but mark time and summary as not completed
    setSections(prev => prev.map(s => {
      if (s.id === 'coach') return { ...s, completed: true };
      if (s.id === 'date') return { ...s, completed: false };
      if (s.id === 'time') return { ...s, completed: false };
      if (s.id === 'summary') return { ...s, completed: false };
      return s;
    }));
    
    // Go back to date selection
    setActiveSection('date');
    
    // Show success message
    toast({
      title: "Timezone Updated",
      description: `Your timezone has been updated to ${timezone}.`,
    });
  }, [toast]);

  const handleDateSelect = useCallback(async (date: Date) => {
    setIsLoadingSlots(true);
    const selectedLocalDate = DateTime.fromJSDate(date).startOf('day').setZone(selectedTimezone, { keepLocalTime: true });
    setSelectedDate(selectedLocalDate.toJSDate());
    
    if (bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
      const suggested = selectedLocalDate.plus({ days: 3 }).toJSDate();
      setSuggestedDate(suggested);
      setIsLoadingSlots(false); 
    } else {
      setSuggestedDate(null);
      try {
        setSections(prev => prev.map(s => s.id === 'date' ? { ...s, completed: true } : s));
        console.log('[handleDateSelect] Setting active section to: time');
        setActiveSection('time');
        
        // Now this call is valid as fetchAvailableSlots is defined above
        fetchAvailableSlots(
          selectedLocalDate.toJSDate(), 
          selectedTimezone,
          bookingPlan?.coach as CoachId || 'MATIAS'
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
    }
  }, [selectedTimezone, bookingPlan?.coach, bookingPlan?.frequency, fetchAvailableSlots, setSections, setActiveSection, toast, setIsLoadingSlots, setSelectedDate, setSuggestedDate]); // Added missing dependency bookingPlan?.frequency

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    if (!slot.available) return;
    
    // Basic validation
    if (!slot.date) {
      toast({
        title: "Error",
        description: "The selected time slot is invalid. Please try another one.",
        variant: "destructive"
      });
      return;
    }
    
    // Ensure that we're working with dates in the user's timezone
    // First convert the date to a DateTime object in the user's timezone
    const slotDateTime = DateTime.fromJSDate(slot.date).setZone(selectedTimezone);
    const slotUTC = slotDateTime.toUTC();
    
    // Create corrected slot directly
    const correctedSlot = {
      ...slot,
      date: slotDateTime.toJSDate(),
      utcDate: slotUTC.toJSDate()
    };
    
    // Update booking data
    const commonBookingData = {
      firstSlot: correctedSlot,
      duration: bookingPlan?.duration || 1,
      frequency: bookingPlan?.frequency || BookingFrequency.Once
    };

    // Evita valores null actualizando con un objeto por defecto
    setBookingPlan(prev => {
      if (bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
        return { 
          ...prev,
          ...commonBookingData
        };
      } else {
        return {
          ...prev,
          ...commonBookingData
        };
      }
    });

    setSelectedSlot(correctedSlot);
    
    setSections(prev => prev.map(s => 
      s.id === 'time' ? { ...s, completed: true } : s
    ));
    setActiveSection('summary');
  }, [bookingPlan, selectedTimezone, setBookingPlan, setSelectedSlot, setSections, setActiveSection, toast]);

  const handleSectionClick = useCallback((sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    
    const previousSectionsCompleted = sections
      .slice(0, sectionIndex)
      .every(s => s.completed);
    
    if (previousSectionsCompleted) {
      setActiveSection(sectionId);
    }
  }, [sections, setActiveSection]);

  const handleFrequencySelect = useCallback(
    (frequency: BookingFrequency, duration?: number) => {
      // Allow any valid frequency to be selected
      setSelectedDate(null)
      setSuggestedDate(null)
      setSelectedSlot(null)
      setAvailableSlots([])
      
      setBookingPlan(prev => ({
        ...prev,
        frequency: frequency,
        duration: duration || (prev?.duration ?? 1)
      }))
      
      setSections(prev => prev.map(s => 
        s.id === 'frequency' ? { ...s, completed: true } : s
      ));
      
      setActiveSection('date')
    }, 
    []
  );

  // New function to handle coach selection
  const handleCoachSelect = useCallback((coach: CoachId) => {
    // Update booking plan with selected coach and always set ONCE frequency
    setBookingPlan(prev => ({
      ...prev,
      coach,
      frequency: BookingFrequency.Once
    }));
    
    // Mark coach section as completed and SKIP frequency section, going straight to date
    setSections(prev => prev.map(s => 
      s.id === 'coach' || s.id === 'frequency' ? { ...s, completed: true } : s
    ));
    setActiveSection('date');
  }, []);

  const formatSlotTime = useCallback((date: Date) => {
    // Usar Luxon para un control más explícito
    
    // Crear objeto DateTime ASUMIENDO que la hora del objeto Date YA está en la zona del usuario.
    const dtUserLocal = DateTime.fromJSDate(date, { zone: selectedTimezone });

    // Usaremos dtUserLocal, que asume que la hora ya es correcta para la zona
    const finalDateTime = dtUserLocal;

    return finalDateTime.toFormat('h:mm a');
  }, [selectedTimezone]);

  const handleBookingConfirm = useCallback(async () => {
    setIsBookingLoading(true);

    try {
      if (!selectedSlot) {
        throw new Error("No time slot was selected");
      }

      // Simplification: get local and UTC date in a single step
      const localDateTime = DateTime.fromJSDate(selectedSlot.date).setZone(selectedTimezone);
      const utcDateTime = localDateTime.toUTC();

      // Use the current selectedSlot directly
      const updatedBookingPlan = {
        ...bookingPlan,
        firstSlot: selectedSlot,
        duration: bookingPlan?.duration || 1,
        frequency: bookingPlan?.frequency || BookingFrequency.Once
      };

      // Create checkout
      const { checkoutUrl, orderId } = await paymentService.createCheckout(
        updatedBookingPlan,
        userProfile as UserProfile,
        true
      );
      
      if (!orderId || !checkoutUrl) {
        throw new Error('Error creating checkout: missing orderId or checkoutUrl');
      }
      
      // Store essential data with the timezone used explicitly
      const tempBookingData = {
        userEmail: userProfile?.email,
        bookingPlan: updatedBookingPlan,
        selectedDate: localDateTime.toISO(),
        utcDate: utcDateTime.toISO(),
        selectedTimezone: selectedTimezone // Always make sure to include timezone
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
  }, [bookingPlan, selectedSlot, userProfile, selectedTimezone, toast]);

  const handleNextSection = useCallback(() => {
    // We can't directly compare 'activeSection' (string) with 'sections.length' (number)
    // Find the index of the active section and increment if it's not the last one
    const activeIndex = sections.findIndex(s => s.id === activeSection);
    if (activeIndex < sections.length - 1) {
      const nextSection = sections[activeIndex + 1].id;
      setActiveSection(nextSection);
    }
  }, [activeSection, sections]);

  const handlePlanSelection = useCallback((plan: BookingPlan) => {
    setBookingPlan(plan);
    handleNextSection();
  }, [handleNextSection]);

  return {
    sections,
    activeSection,
    selectedDate,
    suggestedDate,
    selectedSlot,
    availableSlots,
    bookingPlan,
    userProfile,
    bookedDates,
    isBookingLoading,
    isLoadingSlots,
    selectedTimezone,
    handleEditProfile: handleTimezoneChange,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleFrequencySelect,
    handleCoachSelect,
    handleTimezoneChange,
    formatSlotTime,
    handleBookingConfirm,
    handleNextSection,
    handlePlanSelection,
    fetchAvailableSlots
  }
}

export type BookingCalendarHook = ReturnType<typeof useBookingCalendar>; 