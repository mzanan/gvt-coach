'use client'

import React, { useMemo } from 'react'
import { useBookingCalendar } from './useBookingCalendar'
import { Calendar } from '../Calendar/Calendar'
import { UserProfileForm } from '../../user/UserProfileForm/UserProfileForm'
import { Button } from '@/app/components/ui-kit/button'
import { ChevronDown, ChevronUp, Check, Edit2, Loader2 } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'
import { DateTime } from 'luxon'
import { FrequencySelector } from '../FrequencySelector/FrequencySelector'
import { getBookingSummary, cn } from '@/lib/utils'
import { BookingFrequency } from '@/app/types/enums/booking'

// Definir la constante COACH_TIMEZONE con el mismo valor que se usa en el servicio
const COACH_TIMEZONE = process.env.COACH_TIMEZONE || 'UTC';

// Componente para el botón de proceder al pago, memoizado para reducir renderizados
const PaymentButton = React.memo(({ onClick, isLoading }: { onClick: () => void, isLoading: boolean }) => (
  <Button 
    onClick={onClick} 
    disabled={isLoading}
    className="w-full max-w-sm"
  >
    {isLoading ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : null}
    Proceed to Payment
  </Button>
));
PaymentButton.displayName = 'PaymentButton';

// Componente para renderizar una sección, memoizado para evitar renderizados innecesarios
const BookingSection = React.memo(({ 
  section, 
  activeSection, 
  isAvailable, 
  onSectionClick,
  renderContent
}: { 
  section: { id: string, title: string, completed: boolean }, 
  activeSection: string,
  isAvailable: boolean,
  onSectionClick: (id: string) => void,
  renderContent: () => React.ReactNode
}) => (
  <Card className="overflow-hidden">
    <button
      className={`
        w-full p-4 flex items-center justify-between text-left
        ${isAvailable ? 'hover:bg-accent/50' : 'opacity-50 cursor-not-allowed'}
      `}
      onClick={() => onSectionClick(section.id)}
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
        {renderContent()}
      </div>
    )}
  </Card>
));
BookingSection.displayName = 'BookingSection';

export function BookingCalendar() {
  const {
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
    handleFrequencySelect,
    formatSlotTime,
    handleBookingConfirm
  } = useBookingCalendar()

  // Crear una función local para manejar la cancelación de edición
  const handleCancelEditProfile = React.useCallback(() => {
    // Simplemente reutilizamos handleProfileComplete para cerrar el formulario
    handleProfileComplete();
  }, [handleProfileComplete]);

  // Memoizamos el renderizado del resumen para evitar cálculos repetidos
  const summaryContent = useMemo(() => {
    if (!bookingPlan || !selectedSlot) return null;
    
    if (bookingPlan.frequency === BookingFrequency.TwiceWeekly) {
      const firstSlotDate = bookingPlan?.firstSlot?.date
      const secondSlotDate = bookingPlan?.secondSlot?.date
  
      if (!firstSlotDate || !secondSlotDate) return null
  
      // Calcular precio total (meses x precio por mes)
      const totalPrice = bookingPlan.duration * 100;
  
      return (
        <div className="flex justify-center">
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <p>{getBookingSummary(
                firstSlotDate,
                BookingFrequency.TwiceWeekly,
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
              <p className="mt-2 font-medium">Total Price: ${totalPrice}</p>
            </div>
            <div className="flex justify-center mt-6">
              <PaymentButton onClick={handleBookingConfirm} isLoading={isBookingLoading} />
            </div>
          </div>
        </div>
      )
    }
  
    return (
      <div className="space-y-4 text-center">
        <p className="text-xl">
          {getBookingSummary(selectedSlot.date, bookingPlan.frequency || BookingFrequency.Once, bookingPlan.duration, true, selectedTimezone)}
        </p>
        <p className="font-medium">Price: $100</p>
        <div className="flex justify-center">
          <PaymentButton onClick={handleBookingConfirm} isLoading={isBookingLoading} />
        </div>
      </div>
    )
  }, [bookingPlan, selectedSlot, selectedTimezone, handleBookingConfirm, isBookingLoading]);

  // Función para renderizar el contenido específico de cada sección
  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'frequency':
        return (
          <FrequencySelector 
            onFrequencySelect={handleFrequencySelect} 
            selectedFrequency={bookingPlan?.frequency}
            disableWeekly={true}
            disableTwiceWeekly={true}
          />
        )
      case 'date':
        return (
          <Calendar 
            onSelectDate={handleDateSelect}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            frequency={bookingPlan?.frequency}
            suggestedDate={suggestedDate}
            selectedTimezone={selectedTimezone}
            COACH_TIMEZONE={COACH_TIMEZONE}
          />
        )
      case 'time':
        // Mostrar indicador de carga mientras se cargan los slots
        if (isLoadingSlots) {
          return (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }
        
        // Memoizamos el renderizado de las ranuras de tiempo disponibles
        return (
          <>
            {availableSlots.length === 0 ? (
              <div className="text-center py-4">
                <p>No available slots for this date. Please select another date.</p>
              </div>
            ) : (
              availableSlots.map((dayGroup) => {
                return (
                  <div key={dayGroup.date.toString()} className="mb-4">
                    <h3 className="font-medium mb-2">
                      {DateTime.fromJSDate(dayGroup.date).setZone(selectedTimezone).toFormat('EEEE, MMMM d')}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {dayGroup.slots.map((slot, index) => {
                        return (
                          <Button
                            key={`${slot.date.toString()}-${index}`}
                            variant={selectedSlot?.date.toString() === slot.date.toString() ? 'default' : 'outline'}
                            disabled={!slot.available}
                            onClick={() => {
                              // Add debug logging to trace slot information
                              console.log('Clicked on time slot:', {
                                index,
                                slotDate: slot.date,
                                slotDateISO: slot.date.toISOString(),
                                slotTime: formatSlotTime(slot.date),
                                slotInfo: slot.slot,
                                slotId: slot.slot?.id,
                                slotHour: DateTime.fromJSDate(slot.date).hour,
                                slotMinute: DateTime.fromJSDate(slot.date).minute,
                                selectedTimezone
                              });
                              handleSlotSelect(slot.slot!);
                            }}
                            className={cn(
                              "whitespace-nowrap",
                              !slot.available && "opacity-60 cursor-not-allowed dark:bg-gray-800 bg-gray-100 dark:text-gray-400 text-gray-500"
                            )}
                          >
                            {formatSlotTime(slot.date)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )
      case 'summary':
        return (
          <div className="space-y-6">
            {summaryContent}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between">
        <h2 className="text-2xl font-semibold mb-4">Book a Consultation</h2>
        {userProfile && (
          <div className="flex items-center space-x-2">
            <span>Welcome, {userProfile.first_name}!</span>
            <Button 
              onClick={handleEditProfile}
              variant="ghost" 
              size="sm"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit Profile
            </Button>
          </div>
        )}
      </div>
      
      {isEditingProfile && (
        <Card className="mb-6">
          <div className="p-4">
            <UserProfileForm 
              initialData={userProfile} 
              onComplete={handleProfileComplete}
              showCard={false}
              showTitle={false}
            />
            <div className="mt-2 flex justify-end">
              <Button 
                variant="outline" 
                onClick={handleCancelEditProfile}
                className="ml-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {sections.map((section) => {
        const sectionIndex = sections.findIndex(s => s.id === section.id)
        const previousSectionsCompleted = sections
          .slice(0, sectionIndex)
          .every(s => s.completed)
        const isAvailable = previousSectionsCompleted

        return (
          <BookingSection 
            key={section.id} 
            section={section}
            activeSection={activeSection}
            isAvailable={isAvailable}
            onSectionClick={handleSectionClick}
            renderContent={() => renderSectionContent(section.id)}
          />
        )
      })}
    </div>
  )
}