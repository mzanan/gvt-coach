'use client'

import React, { useMemo } from 'react'
import { useBookingCalendar } from './useBookingCalendar'
import { Calendar } from '../Calendar'
import { Button } from '@/app/components/ui-kit/button'
import { Input } from '@/app/components/ui-kit/input'
import { Check, Loader2, Globe, User, DollarSign, Clock, CreditCard, CalendarIcon, Mail, Pencil } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/app/components/ui-kit/accordion'
import { DateTime } from 'luxon'
import { CoachSelector } from '../CoachSelector'
import { TimeZoneSelector } from '../TimeZoneSelector'
import { BookingSelectionSummary } from '../BookingSelectionSummary'
import { getBookingSummary, cn } from '@/lib/utils'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'


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

const MemoizedBookingSection = React.memo(({
  section,
  activeSection,
  isAvailable,
  summaryText,
  renderContent
}: {
  section: { id: string, title: string, completed: boolean },
  activeSection: string,
  isAvailable: boolean,
  summaryText?: string | null,
  renderContent: () => React.ReactNode
}) => {
  const isCollapsedWithSummary = section.completed && activeSection !== section.id && summaryText;

  return (
    <AccordionItem value={section.id} disabled={!isAvailable} asChild>
      <Card className="overflow-hidden">
        <AccordionTrigger className="p-4">
          <div className="flex items-center space-x-2 min-w-0">
            {section.completed && <Check className="w-4 h-4 shrink-0" />}
            <span className="font-medium shrink-0">{section.title}</span>
            {isCollapsedWithSummary && (
              <span className="lg:hidden text-sm text-muted-foreground truncate">
                &middot; {summaryText}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 border-t">
          {renderContent()}
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
});
MemoizedBookingSection.displayName = 'MemoizedBookingSection';

export function BookingCalendar() {
  const { coaches } = useAppConfig()
  const {
    sections,
    activeSection,
    selectedDate,
    selectedSlot,
    availableSlots,
    bookingPlan,
    bookedDates,
    isBookingLoading,
    isLoadingSlots,
    selectedTimezone,
    userEmail,
    emailError,
    isEmailValid,
    isEditingEmail,
    handleEmailChange,
    handleEmailEditToggle,
    handleEmailKeyDown,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleCoachSelect,
    handleTimezoneChange,
    handleBookingConfirm,
  } = useBookingCalendar()

  const selectedCoachConfig = bookingPlan.coach ? coaches[bookingPlan.coach] : null;

  const dateLabel = useMemo(() => {
    if (!selectedDate) return null;
    return DateTime.fromJSDate(selectedDate).setZone(selectedTimezone).toFormat('EEE, MMM d');
  }, [selectedDate, selectedTimezone]);

  const timeLabel = useMemo(() => {
    if (!selectedSlot) return null;
    return DateTime.fromJSDate(selectedSlot.date).setZone(selectedTimezone).toFormat('h:mm a');
  }, [selectedSlot, selectedTimezone]);

  const dateTimeLabel = dateLabel
    ? (timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel)
    : null;

  const sectionSummaries: Record<string, string | null> = {
    coach: selectedCoachConfig?.displayName || null,
    date: dateLabel,
    time: timeLabel ? (dateLabel ? `${dateLabel}, ${timeLabel}` : timeLabel) : null,
    summary: null,
  };

  const summaryContent = useMemo(() => {
    if (!bookingPlan || !selectedSlot || !bookingPlan.coach) return null;
   
    const coach = bookingPlan.coach;
    const price = coaches[coach].prices.singleSession;
  
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg bg-card shadow-sm">
          <div className="flex flex-col space-y-4">
            {/* Session details */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="mt-1 p-2 bg-primary/10 rounded-full">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Session Details</h3>
                  <p className="text-muted-foreground">
                    {getBookingSummary(selectedSlot.date, true, selectedTimezone)}
                  </p>
                </div>
              </div>
              
              {/* Coach info */}
              {coach && (
                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-2 bg-blue-50 rounded-full dark:bg-blue-900/20">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Coach</h3>
                    <p className="text-muted-foreground">{coaches[coach].displayName}</p>
                  </div>
                </div>
              )}
              
              {/* Price */}
              <div className="flex items-start space-x-3">
                <div className="mt-1 p-2 bg-green-50 rounded-full dark:bg-green-900/20">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Price</h3>
                  <p className="text-xl font-semibold">${price}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-3">
                <div className="mt-1 p-2 bg-primary/10 rounded-full">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-medium">
                    Your email <span className="text-xs font-normal text-muted-foreground">(from your Google account)</span>
                  </h3>
                  {isEditingEmail ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="email"
                        value={userEmail}
                        onChange={e => handleEmailChange(e.target.value)}
                        onKeyDown={handleEmailKeyDown}
                        autoFocus
                        autoComplete="email"
                        className="h-8 max-w-xs"
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? "booking-email-error" : undefined}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleEmailEditToggle}
                        aria-label="Confirm email"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-muted-foreground break-all">{userEmail}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleEmailEditToggle}
                        aria-label="Edit email"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {emailError && (
                    <p id="booking-email-error" role="alert" className="text-xs text-danger-text mt-1">
                      {emailError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Time and timezone */}
            <div className="pt-4 border-t border-muted">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-1" />
                <span>Session time shown in timezone: {selectedTimezone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment button */}
        <Button
          onClick={handleBookingConfirm}
          disabled={isBookingLoading || !isEmailValid}
          className="w-full h-12 text-lg font-medium"
        >
          {isBookingLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Proceed to Payment
            </>
          )}
        </Button>
      </div>
    )
  }, [bookingPlan, selectedSlot, selectedTimezone, handleBookingConfirm, isBookingLoading, coaches, userEmail, isEmailValid, isEditingEmail, emailError, handleEmailChange, handleEmailEditToggle, handleEmailKeyDown]);

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'coach':
        return (
          <CoachSelector 
            onCoachSelect={handleCoachSelect}
            selectedCoach={bookingPlan.coach}
          />
        )
      case 'date':
        if (!bookingPlan.coach) return null;

        return (
          <Calendar
            onSelectDate={handleDateSelect}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            selectedTimezone={selectedTimezone}
            selectedCoach={bookingPlan.coach}
          />
        )
      case 'time': {
        const coach = bookingPlan.coach;
        if (!coach) return null;

        if (isLoadingSlots) {
          return (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        return (
          <>
            {availableSlots.map((dayGroup) => {
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
                            handleSlotSelect(slot);
                          }}
                          className={cn(
                            "whitespace-nowrap",
                            !slot.available && "opacity-60 cursor-not-allowed dark:bg-gray-800 bg-gray-100 dark:text-gray-400 text-gray-500"
                          )}
                        >
                          {DateTime.fromJSDate(slot.date).setZone(selectedTimezone).toFormat('h:mm a')}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                These time slots are available based on {coaches[coach].displayName}&apos;s working hours in their timezone ({coaches[coach].timezone}, UTC{DateTime.now().setZone(coaches[coach].timezone).toFormat('ZZ')}).
              </p>
            </div>
          </>
        )
      }
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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-2xl font-semibold shrink">Book a Consultation</h2>
            <div className="flex items-center space-x-2 shrink-0">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <TimeZoneSelector
                className="max-w-xs"
                currentTimezone={selectedTimezone}
                onTimezoneChange={handleTimezoneChange}
              />
            </div>
        </div>

        <Accordion
          type="single"
          value={activeSection}
          onValueChange={(value) => { if (value) handleSectionClick(value) }}
          className="space-y-6"
        >
          {sections.map((section) => {
            const sectionIndex = sections.findIndex(s => s.id === section.id)
            const previousSectionsCompleted = sections
              .slice(0, sectionIndex)
              .every(s => s.completed)

            const isAvailable =
              section.id === 'date' && bookingPlan?.coach
                ? true
                : previousSectionsCompleted

            return (
              <MemoizedBookingSection
                key={section.id}
                section={section}
                activeSection={activeSection}
                isAvailable={isAvailable}
                summaryText={sectionSummaries[section.id]}
                renderContent={() => renderSectionContent(section.id)}
              />
            )
          })}
        </Accordion>
      </div>

      <div className="hidden lg:block sticky top-6">
        <BookingSelectionSummary
          coachName={selectedCoachConfig?.displayName}
          coachPhotoUrl={selectedCoachConfig?.photoUrl}
          dateTimeLabel={dateTimeLabel}
          email={userEmail || null}
          price={selectedCoachConfig?.prices.singleSession}
          timezone={selectedTimezone}
        />
      </div>
    </div>
  )
}