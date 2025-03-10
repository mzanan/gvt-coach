import { useState, useEffect, useCallback, useMemo } from 'react'
import { TimeSlot, BookingFrequency, BookingPlan } from '@/app/types/booking'
import { UserProfile } from '@/app/types/user'
import { toast } from '@/app/components/ui-kit/use-toast'
import { DateTime } from 'luxon'
import { bookingService } from '@/services/bookingService'
import { paymentService } from '@/services/paymentService'

interface Section {
  id: 'date' | 'time' | 'summary' | 'frequency'
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
  const [sections, setSections] = useState<Section[]>([
    { id: 'frequency', title: 'Select Frequency', completed: false },
    { id: 'date', title: 'Select Date', completed: false },
    { id: 'time', title: 'Select Time', completed: false },
    { id: 'summary', title: 'Booking Summary', completed: false }
  ])
  const [activeSection, setActiveSection] = useState<string>('frequency')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [availableSlots, setAvailableSlots] = useState<DayGroup[]>([])
  const [bookingPlan, setBookingPlan] = useState<BookingPlan | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [bookedDates, setBookedDates] = useState<Array<{ date: Date, fullyBooked: boolean }>>([])
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Memoizar el perfil de usuario para evitar lecturas innecesarias de localStorage
  const cachedUserProfile = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return bookingService.getUserProfile();
  }, []);

  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    return cachedUserProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  useEffect(() => {
    // Only fetch profile on client side
    if (cachedUserProfile) {
      setUserProfile(cachedUserProfile);
      setSelectedTimezone(cachedUserProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [cachedUserProfile]);

  // Memoizar loadBookedDates para evitar recrear la función en cada renderizado
  const loadBookedDates = useCallback(async () => {
    try {
      const dates = await bookingService.getFullyBookedDates(new Date());
      setBookedDates(dates);
    } catch (error) {
      console.error('Error loading booked dates:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar availability. Please try again later.",
        variant: "destructive"
      });
    }
  }, []);

  useEffect(() => {
    loadBookedDates();
  }, [loadBookedDates]);

  // Memoizar loadSlots para evitar recrear la función en cada renderizado
  const loadSlots = useCallback(async (date: Date, timezone: string) => {
    try {
      const groupedSlots = await bookingService.getAvailableSlots(date, timezone)
      
      // Transformar los slots recibidos al formato DayGroup
      const transformedSlots = groupedSlots.map(group => ({
        date: group.date,
        slots: group.slots.map(slot => ({
          date: slot.date,
          available: slot.available,
          slot: slot
        }))
      }));
      
      setAvailableSlots(transformedSlots);
    } catch (error) {
      console.error('Error loading slots:', error)
      toast({
        title: "Error",
        description: "Failed to load available time slots. Please try again.",
        variant: "destructive"
      })
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate, selectedTimezone);
    }
  }, [selectedDate, selectedTimezone, loadSlots]);

  // Memoizar funciones de manejo para evitar recrearlas en cada renderizado
  const handleProfileComplete = useCallback(() => {
    const profile = bookingService.getUserProfile();
    if (profile) {
      setUserProfile(profile);
      setSelectedTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setIsEditingProfile(false);
    }
  }, []);

  const handleEditProfile = useCallback(() => {
    setIsEditingProfile(true);
  }, []);

  const handleDateSelect = useCallback(async (date: Date) => {
    // Mostrar indicador de carga inmediatamente
    setIsLoadingSlots(true);
    
    // Mantener la misma fecha que se seleccionó visualmente
    const selectedLocalDate = DateTime.fromJSDate(date)
      .startOf('day')
      .setZone(selectedTimezone, { keepLocalTime: true });
    
    // Establecer la fecha seleccionada inmediatamente para mejorar la UX
    setSelectedDate(selectedLocalDate.toJSDate());
    
    if (bookingPlan?.frequency === 'twice-weekly') {
      const suggested = selectedLocalDate.plus({ days: 3 }).toJSDate();
      setSuggestedDate(suggested);
      setIsLoadingSlots(false); // No cargamos slots para twice-weekly
    } else {
      setSuggestedDate(null);
      try {
        // Avanzar al siguiente paso inmediatamente mientras se cargan los slots
        setSections(prev => prev.map(s => 
          s.id === 'date' ? { ...s, completed: true } : s
        ));
        setActiveSection('time');
        
        // Cargar los slots después de actualizar la UI
        const groupedSlots = await bookingService.getAvailableSlots(selectedLocalDate.toJSDate(), selectedTimezone);
        
        // Si no hay slots, mostrar mensaje vacío
        if (groupedSlots.length === 0) {
          setAvailableSlots([]);
          setIsLoadingSlots(false);
          return;
        }
        
        // Transformar los slots recibidos al formato DayGroup
        const transformedSlots: DayGroup[] = groupedSlots.map(group => ({
          date: group.date,
          slots: group.slots.map(slot => ({
            date: slot.date,
            available: slot.available,
            slot: slot
          }))
        }));
        
        setAvailableSlots(transformedSlots);
      } catch (error) {
        console.error('Error loading slots:', error);
        toast({
          title: "Error",
          description: "Failed to load available time slots. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingSlots(false);
      }
    }
  }, [bookingPlan, selectedTimezone, setActiveSection, setSections]);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    if (!slot.available) return;
    
    // Create DateTime object in user's timezone
    const slotDateTime = DateTime.fromJSDate(slot.date)
      .setZone(selectedTimezone);
     
    const correctedSlot = {
      ...slot,
      date: slotDateTime.toJSDate(),
      utcDate: slotDateTime.toUTC().toJSDate()
    };
    
    const commonBookingData = {
      firstSlot: correctedSlot,
      duration: bookingPlan?.duration || 1,
      frequency: bookingPlan?.frequency || 'once'
    };

    setBookingPlan(prev => {
      if (bookingPlan?.frequency === 'twice-weekly') {
        return prev ? { ...prev, ...commonBookingData } : null;
      } else {
        return prev ? { ...prev, ...commonBookingData } : commonBookingData;
      }
    });

    setSelectedSlot(correctedSlot);
    
    setSections(prev => prev.map(s => 
      s.id === 'time' ? { ...s, completed: true } : s
    ));
    setActiveSection('summary');
  }, [bookingPlan, selectedTimezone, sections]);

  const handleSectionClick = useCallback((sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    
    const previousSectionsCompleted = sections
      .slice(0, sectionIndex)
      .every(s => s.completed);
    
    if (previousSectionsCompleted) {
      setActiveSection(sectionId);
    }
  }, [sections, setActiveSection]);

  const handleTimezoneChange = useCallback(async (timezone: string) => {
    setSelectedTimezone(timezone)

    // Asegurarse de que la fecha seleccionada se mantiene en el mismo día calendario
    // pero ahora en la nueva zona horaria
    if (selectedDate) {
      try {
        // Mantener la misma fecha en la nueva zona horaria
        const newSelectedDate = DateTime.fromJSDate(selectedDate)
          .setZone(timezone, { keepLocalTime: true })
          .toJSDate()
        
        setSelectedDate(newSelectedDate)

        // También actualizar la fecha sugerida si existe
        if (suggestedDate && bookingPlan?.frequency === 'twice-weekly') {
          const newSuggestedDate = DateTime.fromJSDate(suggestedDate)
            .setZone(timezone, { keepLocalTime: true })
            .toJSDate()
          setSuggestedDate(newSuggestedDate)
        }

        // Recargar los slots disponibles con la nueva zona horaria
        const groupedSlots = await bookingService.getAvailableSlots(newSelectedDate, timezone)
        
        // Transformar los slots a la estructura DayGroup
        const transformedSlots: DayGroup[] = groupedSlots.map(group => ({
          date: group.date,
          slots: group.slots.map(slot => ({
            date: slot.date,
            available: slot.available,
            slot: slot
          }))
        }));
        
        setAvailableSlots(transformedSlots);
        
        // Si estamos en la sección de resumen, también necesitamos actualizar el slot seleccionado
        if (selectedSlot && activeSection === 'summary') {
          // Buscar el slot correspondiente en la nueva zona horaria
          const slotTime = DateTime.fromJSDate(selectedSlot.date)
            .setZone(selectedTimezone)
            .toFormat('HH:mm');
          
          // Buscar un slot con la misma hora
          let matchingSlot = null;
          for (const group of transformedSlots) {
            for (const s of group.slots) {
              const newSlotTime = DateTime.fromJSDate(s.date)
                .setZone(timezone)
                .toFormat('HH:mm');
              
              if (newSlotTime === slotTime && s.available) {
                matchingSlot = s.slot;
                break;
              }
            }
            if (matchingSlot) break;
          }
          
          if (matchingSlot) {
            setSelectedSlot(matchingSlot);
            
            if (bookingPlan) {
              setBookingPlan({
                ...bookingPlan,
                firstSlot: matchingSlot
              });
            }
          }
        }
      } catch (error) {
        console.error('Error al actualizar zona horaria:', error);
        toast({
          title: "Error",
          description: "No se pudo actualizar la zona horaria. Por favor, inténtelo de nuevo.",
          variant: "destructive"
        });
      }
    }
  }, [selectedDate, setSelectedTimezone]);

  const handleFrequencySelect = useCallback((frequency: BookingFrequency, duration?: number) => {
    setSelectedDate(null)
    setSuggestedDate(null)
    setSelectedSlot(null)
    setAvailableSlots([])
    
    // FUTURE IMPLEMENTATION: Re-enable weekly and twice-weekly booking options
    // For now, only single sessions are supported
    if (frequency !== 'once') {
      return;
    }
    
    setBookingPlan({ 
      frequency, 
      duration: duration || 1 
    })
    
    setSections(prev => prev.map(s => 
      s.id === 'frequency' ? { ...s, completed: true } : s
    ))
    setActiveSection('date')
  }, []);

  const formatSlotTime = useCallback((date: Date) => {
    return DateTime.fromJSDate(date)
      .setZone(selectedTimezone)
      .toFormat('h:mm a');
  }, [selectedTimezone]);

  const handleBookingConfirm = useCallback(async () => {
    setIsBookingLoading(true);

    try {
      // Get selected date information
      const startDate = new Date(selectedSlot?.date || new Date());

      // First get the orderId from checkout
      console.log('Creating checkout with payment service...');
      const { checkoutUrl, orderId } = await paymentService.createCheckout(
        bookingPlan as BookingPlan, 
        userProfile as UserProfile
      );
      
      if (!orderId || !checkoutUrl) {
        throw new Error('Failed to create checkout: missing orderId or checkoutUrl');
      }
      
      // Store basic information before creating booking
      const tempBookingData = {
        userEmail: userProfile?.email,
        selectedTimezone,
        orderId,
        bookingPlan,
        selectedDate: startDate.toISOString() // Add the selected date
      };
      
      // Store temporary data
      localStorage.setItem('pendingBooking', JSON.stringify(tempBookingData));
      
      // The button will remain disabled because we don't modify isBookingLoading after this point,
      // which keeps the button in a loading state until the user is redirected
      window.location.href = checkoutUrl;
      
      // Note: We've removed the booking creation step from here.
      // The booking will be created after payment confirmation in the success page
      // This prevents the foreign key constraint error
    } catch (error) {
      console.error('Error creating booking:', error);
      // Only re-enable the button if there's an error
      setIsBookingLoading(false);
    }
  }, [bookingPlan, selectedSlot, userProfile, selectedTimezone]);

  const handleNextSection = useCallback(() => {
    // No podemos comparar directamente 'activeSection' (string) con 'sections.length' (number)
    // Encontramos el índice de la sección activa y incrementamos si no es la última
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
    isEditingProfile,
    bookedDates,
    isBookingLoading,
    isLoadingSlots,
    selectedTimezone,
    handleProfileComplete,
    handleEditProfile,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleTimezoneChange,
    handleFrequencySelect,
    formatSlotTime,
    handleBookingConfirm,
    handleNextSection,
    handlePlanSelection
  }
}

export type BookingCalendarHook = ReturnType<typeof useBookingCalendar>; 