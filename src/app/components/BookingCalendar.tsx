'use client'

import { useState, useEffect } from 'react'
import { Calendar } from './Calendar'
import { UserProfileForm } from './UserProfileForm'
import { TimeSlot, BookingFrequency, BookingPlan } from '../types/booking'
import { bookingService } from '../services/bookingService'
import { UserProfile } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Check, Edit2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { DateTime } from 'luxon'
import { FrequencySelector } from './FrequencySelector'
import { getBookingSummary } from '@/lib/utils'
import { TwiceWeeklySelector } from './TwiceWeeklySelector'
import { cn } from '@/lib/utils'
import { paymentService } from '../services/paymentService'

interface Section {
  id: 'date' | 'time' | 'summary' | 'frequency'
  title: string
  completed: boolean
}

interface GroupedTimeSlots {
  date: Date;
  available: boolean;
  slot: TimeSlot | null;
}

interface DayGroup {
  date: Date;
  slots: GroupedTimeSlots[];
}

export function BookingCalendar() {
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
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    const profile = bookingService.getUserProfile();
    return profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });
  const router = useRouter()

  useEffect(() => {
    // Only fetch profile on client side
    const profile = bookingService.getUserProfile();
    if (profile) {
      setUserProfile(profile);
      setSelectedTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, []);

  useEffect(() => {
    const loadBookedDates = async () => {
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
    };
    loadBookedDates();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const loadSlots = async () => {
        try {
          const groupedSlots = await bookingService.getAvailableSlots(selectedDate, selectedTimezone)
          
          // Group slots by day
          const slotsMap = new Map<string, GroupedTimeSlots[]>();
          
          groupedSlots.flatMap(group => 
            group.slots.forEach(slot => {
              const slotDateTime = DateTime.fromJSDate(slot.date)
                .setZone(selectedTimezone);
              const dayKey = slotDateTime.toFormat('yyyy-MM-dd');
              
              if (!slotsMap.has(dayKey)) {
                slotsMap.set(dayKey, []);
              }
              
              slotsMap.get(dayKey)?.push({
                date: slot.date,
                available: slot.available,
                slot: slot
              });
            })
          );

          // Convert map to array and sort by date
          const transformedSlots = Array.from(slotsMap.entries())
            .sort(([dateA], [dateB]) => DateTime.fromFormat(dateA, 'yyyy-MM-dd').toMillis() - 
                                      DateTime.fromFormat(dateB, 'yyyy-MM-dd').toMillis())
            .map(([date, slots]) => ({
              date: DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate(),
              slots
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
      }
      loadSlots()
    }
  }, [selectedTimezone, selectedDate])

  const handleProfileComplete = () => {
    const profile = bookingService.getUserProfile();
    if (profile) {
      setUserProfile(profile);
      setSelectedTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }

  const handleEditProfile = () => {
    setIsEditingProfile(true)
  }

  const handleDateSelect = async (date: Date) => {
    // Mantener la misma fecha que se seleccionó visualmente
    const selectedLocalDate = DateTime.fromJSDate(date)
      .startOf('day')
      .setZone(selectedTimezone, { keepLocalTime: true });
    
    if (bookingPlan?.frequency === 'twice-weekly') {
      const suggested = selectedLocalDate.plus({ days: 3 }).toJSDate();
      setSelectedDate(selectedLocalDate.toJSDate());
      setSuggestedDate(suggested);
    } else {
      setSelectedDate(selectedLocalDate.toJSDate());
      setSuggestedDate(null);
      try {
        const groupedSlots = await bookingService.getAvailableSlots(selectedLocalDate.toJSDate(), selectedTimezone);
        const transformedSlots = [{
          date: selectedLocalDate.toJSDate(),
          slots: groupedSlots.flatMap(group => 
            group.slots.map(slot => ({
              date: slot.date,
              available: slot.available,
              slot: slot
            }))
          )
        }];
        setAvailableSlots(transformedSlots);
        setSections(prev => prev.map(s => 
          s.id === 'date' ? { ...s, completed: true } : s
        ));
        setActiveSection('time');
      } catch (error) {
        console.error('Error loading slots:', error);
        toast({
          title: "Error",
          description: "Failed to load available time slots. Please try again.",
          variant: "destructive"
        });
      }
    }
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    
    // Create DateTime object in user's timezone
    const slotDateTime = DateTime.fromJSDate(slot.date)
      .setZone(selectedTimezone);
    
    const correctedSlot = {
      ...slot,
      date: slotDateTime.toJSDate(),
      utcDate: slotDateTime.toUTC().toJSDate()
    };
    
    if (bookingPlan?.frequency === 'twice-weekly') {
      setSelectedSlot(correctedSlot);
      setBookingPlan(prev => prev ? { ...prev, firstSlot: correctedSlot as TimeSlot } : prev);
      setSections(prev => prev.map(s => 
        s.id === 'time' ? { ...s, completed: true } : s
      ));
      setActiveSection('summary');
    } else {
      setSelectedSlot(correctedSlot);
      setSections(prev => prev.map(s => 
        s.id === 'time' ? { ...s, completed: true } : s
      ));
      setActiveSection('summary');
    }
  }

  const handleSectionClick = (sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId)
    
    const previousSectionsCompleted = sections
      .slice(0, sectionIndex)
      .every(s => s.completed)
    
    if (previousSectionsCompleted) {
      setActiveSection(sectionId)
    }
  }

  const handleTimezoneChange = async (timezone: string) => {
    setSelectedTimezone(timezone)

    if (activeSection === 'summary' && selectedDate) {
      try {
        const newSelectedDate = DateTime.fromJSDate(selectedDate)
          .setZone(timezone, { keepLocalTime: true })
          .toJSDate()
        setSelectedDate(newSelectedDate)

        if (suggestedDate && bookingPlan?.frequency === 'twice-weekly') {
          const newSuggestedDate = DateTime.fromJSDate(suggestedDate)
            .setZone(timezone, { keepLocalTime: true })
            .toJSDate()
          setSuggestedDate(newSuggestedDate)
        }

        const groupedSlots = await bookingService.getAvailableSlots(newSelectedDate, timezone)
        const transformedSlots = [{
          date: newSelectedDate,
          slots: groupedSlots.flatMap(group => 
            group.slots.map(slot => ({
              date: slot.date,
              available: slot.available,
              slot: slot
            }))
          )
        }];
        setAvailableSlots(transformedSlots);

        if (selectedSlot) {
          const newSlotDateTime = DateTime.fromJSDate(selectedSlot.date)
            .setZone(timezone, { keepLocalTime: true })
          
          const matchingSlot = transformedSlots[0].slots.find(slot => 
            DateTime.fromJSDate(slot.date).toFormat('HH:mm') === 
            newSlotDateTime.toFormat('HH:mm')
          )

          if (matchingSlot) {
            setSelectedSlot(matchingSlot.slot)
            if (bookingPlan?.frequency === 'twice-weekly') {
              setBookingPlan(prev => prev ? {
                ...prev,
                firstSlot: matchingSlot.slot
              } : prev)
            }
          }
        }
      } catch (error) {
        console.error('Error updating timezone:', error)
        toast({
          title: "Error",
          description: "Failed to update timezone. Please try again.",
          variant: "destructive"
        })
      }
    }
  }

  const handleFrequencySelect = (frequency: BookingFrequency, duration?: number) => {
    setSelectedDate(null)
    setSuggestedDate(null)
    setSelectedSlot(null)
    setAvailableSlots([])
    
    setBookingPlan({ 
      frequency, 
      duration: duration || 1 
    })
    
    setSections(prev => prev.map(s => 
      s.id === 'frequency' ? { ...s, completed: true } : s
    ))
    setActiveSection('date')
  }

  const formatSlotTime = (date: Date) => {
    const slotDateTime = DateTime.fromJSDate(date)
      .setZone(selectedTimezone);
    
    return slotDateTime.toFormat('hh:mm a');
  }

  const handleBookingConfirm = async () => {
    setIsBookingLoading(true);
    try {
      if (!bookingPlan) {
        throw new Error('Booking plan is not set');
      }
      if (!userProfile) {
        throw new Error('User profile is not set');
      }
  
      let startDate: Date;
      if (bookingPlan.frequency === 'twice-weekly') {
        if (!bookingPlan.firstSlot) {
          throw new Error('First booking slot is not set');
        }
        startDate = bookingPlan.firstSlot.date;
      } else {
        if (!selectedSlot) {
          throw new Error('No time slot selected');
        }
        startDate = selectedSlot.date;
      }
  
      const endDate = bookingPlan.frequency !== 'once' 
        ? DateTime.fromJSDate(startDate)
            .plus({ months: bookingPlan.duration || 0 })
            .toJSDate()
        : null;
  
      const checkoutUrl = await paymentService.createCheckout(bookingPlan, userProfile);
      
      const savedBookings = await bookingService.createBooking(
        userProfile.email, 
        startDate,
        bookingPlan.frequency,
        endDate,
        bookingPlan.duration,
        bookingPlan.secondSlot?.date,
        undefined
      );

      const bookingData = {
        userEmail: userProfile.email,
        selectedTimezone,
        bookingId: savedBookings[0].id,
        booking: savedBookings[0] 
      };

      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
  
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Booking confirmation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm booking. Please try again later.",
        variant: "destructive"
      });
      
      localStorage.removeItem('pendingBooking');
      
      router.push('/');
    } finally {
      setIsBookingLoading(false);
    }
  };

  const renderSummary = () => {
    if (bookingPlan?.frequency === 'twice-weekly') {
      const firstSlotDate = bookingPlan?.firstSlot?.date
      const secondSlotDate = bookingPlan?.secondSlot?.date
  
      if (!firstSlotDate || !secondSlotDate) return null
  
      return (
        <div className="flex justify-center">
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <p>{getBookingSummary(
                firstSlotDate,
                'twice-weekly',
                bookingPlan.duration,
                true,
                selectedTimezone,
                secondSlotDate
              )}</p>
              <p>Duration: {bookingPlan.duration} {bookingPlan.duration === 1 ? 'month' : 'months'}</p>
              <p className="mt-4">Starting from {DateTime.fromJSDate(firstSlotDate).toFormat('MMMM d, yyyy')}</p>
              <p>Ending on {DateTime.fromJSDate(secondSlotDate)
                .plus({ months: bookingPlan.duration })
                .toFormat('MMMM d, yyyy')}</p>
            </div>
            <div className="flex justify-center mt-6">
              <Button 
                onClick={handleBookingConfirm} 
                disabled={isBookingLoading}
                className="w-full max-w-sm"
              >
                {isBookingLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      )
    }
  
    return (
      <div className="space-y-4 text-center">
        <p className="text-xl">
          {getBookingSummary(selectedSlot!.date, bookingPlan?.frequency || 'once', bookingPlan?.duration, true, selectedTimezone)}
        </p>
        <div className="flex justify-center">
          <Button 
            onClick={handleBookingConfirm} 
            disabled={isBookingLoading}
            className="w-full max-w-sm"
          >
            {isBookingLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Proceed to Payment
          </Button>
        </div>
      </div>
    )
  }

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'frequency':
        return (
          <FrequencySelector 
            onFrequencySelect={handleFrequencySelect} 
            selectedFrequency={bookingPlan?.frequency}
          />
        )
      case 'date':
        return (
          <Calendar 
            onSelectDate={handleDateSelect}
            onConfirmDates={(firstDate, secondDate) => {
              setSelectedDate(firstDate)
              setSuggestedDate(secondDate)
              setSections(prev => prev.map(s => 
                s.id === 'date' ? { ...s, completed: true } : s
              ))
              setActiveSection('time')
            }}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            frequency={bookingPlan?.frequency}
            suggestedDate={suggestedDate}
            selectedTimezone={selectedTimezone}
          />
        )
      case 'time':
        if (bookingPlan?.frequency === 'twice-weekly') {
          return (
            <TwiceWeeklySelector
              firstDate={selectedDate!}
              duration={bookingPlan.duration}
              timezone={selectedTimezone}
              onComplete={(firstSlot, secondSlot) => {
                setBookingPlan(prev => prev ? {
                  ...prev,
                  firstSlot,
                  secondSlot
                } : prev);
                setSections(prev => prev.map(s => 
                  s.id === 'time' ? { ...s, completed: true } : s
                ));
                setActiveSection('summary');
              }}
            />
          );
        }
        
        return (
          <>
            {availableSlots.map((dayGroup) => (
              <div key={dayGroup.date.toString()} className="mb-6">
                <h3 className="text-sm font-medium mb-2">
                  {DateTime.fromJSDate(dayGroup.date)
                    .setZone(selectedTimezone)
                    .toFormat('cccc, MMMM d')}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {dayGroup.slots.map((slot, index) => (
                    <Button
                      key={`${slot.date.toString()}-${index}`}
                      variant={selectedSlot?.date.toString() === slot.date.toString() ? 'default' : 'outline'}
                      disabled={!slot.available}
                      onClick={() => handleSlotSelect(slot.slot!)}
                      className={cn(
                        "whitespace-nowrap",
                        !slot.available && "opacity-60 cursor-not-allowed dark:bg-gray-800 bg-gray-100 dark:text-gray-400 text-gray-500"
                      )}
                    >
                      {formatSlotTime(slot.date)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )
      case 'summary':
        return (
        <div className="space-y-6">
          {renderSummary()}
        </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-[46rem] mx-auto space-y-6">
      {/* User Profile Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Personal Information</h2>
          {!isEditingProfile && (
            <Button variant="ghost" size="sm" onClick={handleEditProfile}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        
        {isEditingProfile ? (
          <UserProfileForm 
            onComplete={() => {
              handleProfileComplete()
              setIsEditingProfile(false)
            }}
            initialData={userProfile}
            showCard={false}
            showTitle={false}
            selectedTimezone={selectedTimezone}
            onTimezoneChange={handleTimezoneChange}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {userProfile?.first_name} {userProfile?.last_name}</p>
              <p><span className="font-medium">Email:</span> {userProfile?.email}</p>
              <p><span className="font-medium">Phone:</span> {userProfile?.phone}</p>
              <p><span className="font-medium">Timezone:</span> {selectedTimezone || 'Loading...'}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Collapsible Sections */}
      {sections.map((section) => {
        const sectionIndex = sections.findIndex(s => s.id === section.id)
        const previousSectionsCompleted = sections
          .slice(0, sectionIndex)
          .every(s => s.completed)
        const isAvailable = previousSectionsCompleted

        return (
          <Card
            key={section.id}
            className="overflow-hidden"
          >
            <button
              className={`
                w-full p-4 flex items-center justify-between text-left
                ${isAvailable ? 'hover:bg-accent/50' : 'opacity-50 cursor-not-allowed'}
              `}
              onClick={() => handleSectionClick(section.id)}
              disabled={!isAvailable}
            >
              <div className="flex items-center space-x-2">
                {section.completed && <Check className="w-4 h-4" />}
                <span className="font-medium">{section.title}</span>
              </div>
              {activeSection === section.id ? 
                <ChevronUp className="w-4 h-4" /> : 
                <ChevronDown className="w-4 h-4" />
              }
            </button>
            
            {activeSection === section.id && isAvailable && (
              <div className="p-4 border-t">
                {renderSectionContent(section.id)}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}