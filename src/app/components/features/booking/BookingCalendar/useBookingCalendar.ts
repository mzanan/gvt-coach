import { useState, useEffect, useCallback, useMemo } from 'react'
import { TimeSlot, BookingPlan } from '@/app/types/booking'
import { UserProfile } from '@/app/types/user'
import { toast } from '@/app/components/ui-kit/use-toast'
import { DateTime } from 'luxon'
import { bookingService } from '@/services/bookingService'
import { paymentService } from '@/services/payments'
import { BookingFrequency } from '@/app/types/enums/booking'
import { useDebouncedCallback } from 'use-debounce'
import { lemonSqueezyService } from '@/services/payments/lemonsqueezy'
import { setClientCookie } from '@/lib/utils/cookies'
import { userService } from '@/services/userService'
import { useToast } from '@/app/components/ui-kit/use-toast'

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
  const { toast } = useToast()
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
  const [bookingPlan, setBookingPlan] = useState<BookingPlan>({
    frequency: BookingFrequency.Once,
    duration: 1
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
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
    // Cargar datos del usuario desde el servicio
    const loadUserData = async () => {
      try {
        const userData = await userService.getUserFromAuthUsers();
        if (userData) {
          setUserProfile(userData);
          setSelectedTimezone(userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
      } catch (error) {
        console.error('Error al cargar datos de usuario:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos del usuario.",
          variant: "destructive"
        });
      }
    };
    
    loadUserData();
  }, [toast]);

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
    // No hace nada, ya que no hay edición de perfil
  }, []);

  const handleEditProfile = useCallback(() => {
    // No hace nada, ya que no hay edición de perfil
    toast({
      title: "Información",
      description: "La edición de perfil no está disponible. Los datos se obtienen automáticamente.",
    });
  }, [toast]);

  const handleDateSelect = useCallback(async (date: Date) => {
    // Mostrar indicador de carga inmediatamente
    setIsLoadingSlots(true);
    
    // Mantener la misma fecha que se seleccionó visualmente
    const selectedLocalDate = DateTime.fromJSDate(date)
      .startOf('day')
      .setZone(selectedTimezone, { keepLocalTime: true });
    
    // Establecer la fecha seleccionada inmediatamente para mejorar la UX
    setSelectedDate(selectedLocalDate.toJSDate());
    
    if (bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
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
    
    // Validación básica
    if (!slot.date) {
      console.error('ERROR: Slot inválido sin fecha', slot);
      toast({
        title: "Error",
        description: "El horario seleccionado es inválido. Por favor, intenta con otro.",
        variant: "destructive"
      });
      return;
    }
    
    // Conversión de fecha simplificada - un solo paso
    const slotDateTime = DateTime.fromJSDate(slot.date).setZone(selectedTimezone);
    const slotUTC = slotDateTime.toUTC();
    
    // Log simplificado con información esencial
    console.log(`Slot seleccionado:`, {
      local: slotDateTime.toISO(),
      utc: slotUTC.toISO(),
      hora: slotDateTime.hour,
      minuto: slotDateTime.minute
    });
    
    // Crear slot corregido de forma directa
    const correctedSlot = {
      ...slot,
      date: slotDateTime.toJSDate(),
      utcDate: slotUTC.toJSDate()
    };
    
    // Actualizar datos de reserva
    const commonBookingData = {
      firstSlot: correctedSlot,
      duration: bookingPlan?.duration || 1,
      frequency: bookingPlan?.frequency || BookingFrequency.Once
    };

    setBookingPlan(prev => {
      if (bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
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
  }, [bookingPlan, selectedTimezone]);

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
        if (suggestedDate && bookingPlan?.frequency === BookingFrequency.TwiceWeekly) {
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
        console.error('Error updating timezone:', error);
        toast({
          title: "Error",
          description: "Could not update timezone. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [selectedDate, setSelectedTimezone]);

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

  const formatSlotTime = useCallback((date: Date) => {
    const dateTime = DateTime.fromJSDate(date).setZone(selectedTimezone);
    return dateTime.hour === 0 && dateTime.minute === 0 
      ? "00:00" 
      : dateTime.toFormat('h:mm a');
  }, [selectedTimezone]);

  const handleBookingConfirm = useCallback(async () => {
    setIsBookingLoading(true);

    try {
      if (!selectedSlot) {
        throw new Error("No se seleccionó ningún horario");
      }

      // Simplificación: obtener fecha local y UTC en un solo paso
      const localDateTime = DateTime.fromJSDate(selectedSlot.date).setZone(selectedTimezone);
      const utcDateTime = localDateTime.toUTC();

      // Log simplificado con información clave
      console.log('Confirmando reserva:', {
        fecha_local: localDateTime.toISO(),
        fecha_utc: utcDateTime.toISO(),
        hora_local: localDateTime.toFormat('HH:mm'),
        hora_utc: utcDateTime.toFormat('HH:mm')
      });

      // Usar directamente el selectedSlot actual
      const updatedBookingPlan = {
        ...bookingPlan,
        firstSlot: selectedSlot,
        duration: bookingPlan?.duration || 1,
        frequency: bookingPlan?.frequency || BookingFrequency.Once
      };

      // Crear checkout
      const { checkoutUrl, orderId } = await paymentService.createCheckout(
        updatedBookingPlan,
        userProfile as UserProfile,
        true
      );
      
      if (!orderId || !checkoutUrl) {
        throw new Error('Error al crear checkout: falta orderId o checkoutUrl');
      }
      
      // Almacenar datos esenciales
      const tempBookingData = {
        userEmail: userProfile?.email,
        bookingPlan: updatedBookingPlan,
        selectedDate: localDateTime.toISO(),
        utcDate: utcDateTime.toISO()
      };
      
      setClientCookie('pending_booking', tempBookingData);
      
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error al crear reserva:', error);
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