import { BookingFrequency, PaymentOrderStatus } from './enums/booking';
import { Coach } from './enums/coach';

export interface Booking {
  id: string
  userId: string
  date: Date
  status: PaymentOrderStatus
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

export interface BookingPlan {
  coach?: Coach;
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
  user_name?: string;
  booking_date: string;
  end_date?: string;
  frequency: BookingFrequency;
  status: PaymentOrderStatus;
  meet_link: string;
  recurring_day?: string; 
  recurring_time?: string;
  second_booking_date?: string | null;
  duration?: number;
  user_timezone?: string;
  payment_status?: string;
  payment_confirmed?: boolean;
  checkout_completed?: boolean;
  checkout_order_id?: string;
  confirmation_email_sent?: boolean;
  session_minutes?: number;
  coach?: Coach;
} 