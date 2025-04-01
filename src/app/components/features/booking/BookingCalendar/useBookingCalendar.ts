import { useState, useEffect, useCallback, useMemo } from 'react'
import { TimeSlot, BookingPlan } from '@/app/types/booking'
import { UserProfile } from '@/app/types/user'
import { DateTime } from 'luxon'
import { bookingService } from '@/services/bookingService'
import { paymentService } from '@/services/payments'
import { BookingFrequency } from '@/app/types/enums/booking'
import { setClientCookie, setTimezoneCookie, getTimezoneCookie } from '@/lib/utils/cookies'
import { userService } from '@/services/userService'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { Coach } from '@/app/config/coaches'

interface Section {
  id: 'coach' | 'frequency' | 'date' | 'time' | 'summary'
  title: string
  completed: boolean
}

interface InternalGroupedTimeSlots {
  date: Date;
  available: boolean;
  slot: TimeSlot | null;
}

interface DayGroup {
  date: Date;
  slots: InternalGroupedTimeSlots[];
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

  // Caching user profile to avoid unnecessary localStorage reads
  const cachedUserProfile = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return bookingService.getUserProfile();
  }, []);

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
      const profileTimezone = cachedUserProfile?.timezone;
      
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
          // Asegurarse de que el objeto tenga todos los campos requeridos para UserProfile
          const userProfileData: UserProfile = {
            id: userData.id || '',
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: '', // Añadir el campo phone que falta
            timezone: userData.timezone,
            full_name: `${userData.first_name} ${userData.last_name}`
          };
          
          setUserProfile(userProfileData);
          
          // Ya no necesitamos establecer la timezone aquí, useState lo hace al inicio
          // El código que estaba aquí fue eliminado para evitar sobrescrituras.
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Could not load user data.",
          variant: "destructive"
        });
      }
    };
    
    loadUserData();
  }, [toast]); // Mantenemos toast como dependencia si se usa

  // Memoizar loadBookedDates para evitar recrear la función en cada renderizado
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

  // Memoizar loadSlots para evitar recrear la función en cada renderizado
  const loadSlots = useCallback(async (date: Date, timezone: string) => {
    try {
      setIsLoadingSlots(true);
      
      const groupedSlots = await bookingService.getAvailableSlots(
        date, 
        timezone,
        bookingPlan?.coach || Coach.Matias
      );
      
      // Transform received slots to the DayGroup format
      const transformedSlots: DayGroup[] = groupedSlots.map(group => ({
        date: group.date,
        slots: group.slots.map(slot => {
          // Confiar en que los slots ya vienen con la timezone correcta del servicio
          return {
            date: slot.date,
            available: slot.available,
            slot: slot // Pasar el slot original tal cual
          };
        })
      }));
      
      setAvailableSlots(transformedSlots);
    } catch {
      console.error('Error loading slots:');
      toast({
        title: "Error",
        description: "Failed to load available time slots. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [bookingPlan?.coach, toast]);

  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate, selectedTimezone);
    }
  }, [selectedDate, selectedTimezone, loadSlots]);

  // Memoizar funciones de manejo para evitar recrearlas en cada renderizado
  const handleProfileComplete = useCallback(() => {
    // No hace nada, ya que no hay edición de perfil
  }, []);

  const handleTimezoneChange = useCallback((timezone: string) => {
    // Update state
    setSelectedTimezone(timezone);
    
    // Update cookie
    setTimezoneCookie(timezone);
    
    // Reset all selected values except coach
    setSelectedDate(null);
    setSuggestedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]);
    
    // Preserve only coach selection in booking plan
    setBookingPlan(prev => ({
      ...prev,
      coach: prev?.coach,
      frequency: BookingFrequency.Once,
      duration: 1 // Valor por defecto para evitar null
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
  }, []);

  const handleDateSelect = useCallback(async (date: Date) => {
    // Show loading indicator immediately
    setIsLoadingSlots(true);
    
    // Keep the same date that was visually selected
    const selectedLocalDate = DateTime.fromJSDate(date)
      .startOf('day')
      .setZone(selectedTimezone, { keepLocalTime: true });
    
    // Set selected date immediately to improve UX
    setSelectedDate(selectedLocalDate.toJSDate());
    
    if (bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
      const suggested = selectedLocalDate.plus({ days: 3 }).toJSDate();
      setSuggestedDate(suggested);
      setIsLoadingSlots(false); // We don't load slots for twice-weekly
    } else {
      setSuggestedDate(null);
      try {
        // Move to the next step immediately while slots are loading
        setSections(prev => prev.map(s => 
          s.id === 'date' ? { ...s, completed: true } : s
        ));
        setActiveSection('time');
        
        // Load slots after updating the UI
        const groupedSlots = await bookingService.getAvailableSlots(
          selectedLocalDate.toJSDate(), 
          selectedTimezone,
          bookingPlan?.coach || Coach.Matias
        );
        
        // If no slots, show empty message
        if (groupedSlots.length === 0) {
          setAvailableSlots([]);
          setIsLoadingSlots(false);
          return;
        }
        
        // Transform received slots to the DayGroup format
        const transformedSlots: DayGroup[] = groupedSlots.map(group => ({
          date: group.date,
          slots: group.slots.map(slot => {
            // Confiar en que los slots ya vienen con la timezone correcta del servicio
            return {
              date: slot.date,
              available: slot.available,
              slot: slot // Pasar el slot original tal cual
            };
          })
        }));
        
        setAvailableSlots(transformedSlots);
      } catch (error: unknown) {
        console.error('Error loading slots:', error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load available time slots. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingSlots(false);
      }
    }
  }, [bookingPlan, selectedTimezone, setActiveSection, setSections, toast]);

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
  const handleCoachSelect = useCallback((coach: Coach) => {
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
      toast({
        title: "Error",
        description: error?.message || "Error creating booking.",
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

  const fetchAvailableSlots = useCallback(async (date: Date) => {
    try {
      setIsLoadingSlots(true);
      const groupedSlots = await bookingService.getAvailableSlots(
        date,
        selectedTimezone,
        bookingPlan?.coach || Coach.Matias
      );
      
      // Transformar los slots para que coincidan con el tipo DayGroup[]
      const transformedSlots: DayGroup[] = groupedSlots.map(group => ({
        date: group.date,
        slots: group.slots.map(slot => ({
          date: slot.date,
          available: slot.available,
          slot: slot
        }))
      }));
      
      setAvailableSlots(transformedSlots);
    } catch (error: unknown) {
      console.error('Error fetching available slots:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch available time slots. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSlots(false);
    }
  }, [selectedTimezone, bookingPlan?.coach, toast]);

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
    handleProfileComplete,
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