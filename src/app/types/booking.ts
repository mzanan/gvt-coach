export enum BookingStatus {
  PENDING_PAYMENT = 'pending-payment',
  PAYMENT_FAILED = 'payment-failed',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled'
}

export interface Booking {
  id: string
  userId: string
  date: Date
  status: BookingStatus
  meetLink: string
}

export interface TimeSlot {
  id: string
  date: Date
  available: boolean
  utcDate: Date
}

export interface GroupedTimeSlots {
  date: Date;
  slots: TimeSlot[];
}

export type BookingFrequency = 'weekly' | 'twice-weekly' | 'once';

export interface BookingPlan {
  frequency: BookingFrequency;
  duration: number;
  firstSlot?: TimeSlot;
  secondSlot?: TimeSlot;
  variantId?: string;
  bookingId?: string;
}