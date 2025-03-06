import { BookingFrequency as FrequencyEnum, BookingStatus as StatusEnum } from './enums/booking';

export enum BookingStatus {
  PENDING_PAYMENT = 'pending-payment',
  PAYMENT_FAILED = 'payment-failed',
  PAYMENT_PROCESSING = 'payment-processing',
  PAYMENT_SUCCESSFUL = 'payment-successful',
  BOOKING_CONFIRMED = 'booking-confirmed',
  BOOKING_CANCELLED = 'booking-cancelled',
}

export interface Booking {
  id: string
  userId: string
  date: Date
  status: BookingStatus
  meetLink: string
}

export interface TimeSlot {
  id: string;
  start_time?: string | Date;
  end_time?: string | Date;
  available: boolean;
  booked?: boolean;
  date: Date;
  utcDate: Date;
}

export interface GroupedTimeSlots {
  date: Date;
  slots: TimeSlot[];
}

export type BookingFrequency = 'weekly' | 'twice-weekly' | 'once';

export interface BookingPlan {
  frequency: BookingFrequency;
  duration: number;
  price?: number;
  hasDiscount?: boolean;
  discountPrice?: number;
  productId?: string;
  variantId?: string;
  bookingId?: string;
  firstSlot?: TimeSlot;
  secondSlot?: TimeSlot;
}

export interface BookingDB {
  id: string;
  user_email: string;
  booking_date: string;
  end_date?: string;
  frequency: FrequencyEnum;
  status: StatusEnum;
  meet_link: string;
  recurring_day?: string; 
  recurring_time?: string;
  second_booking_date?: string | null;
  duration?: number;
} 