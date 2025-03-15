/**
 * Unified booking status enum for all booking-related functionality
 */
export enum BookingStatus {
  PendingPayment = 'pending-payment',
  PaymentFailed = 'payment-failed',
  PaymentProcessing = 'payment-processing',
  PaymentSuccessful = 'payment-successful',
  BookingConfirmed = 'booking-confirmed',
  BookingCancelled = 'booking-cancelled',
}

/**
 * Frequency options for booking appointments
 */
export enum BookingFrequency {
  Once = 'ONCE',
  Weekly = 'WEEKLY',
  TwiceWeekly = 'TWICE_WEEKLY'
}

/**
 * Payment order statuses
 */
export enum PaymentOrderStatus {
  Active = 'ACTIVE',
  Pending = 'PENDING',
  Paid = 'PAID',
  Void = 'VOID',
  Completed = 'COMPLETED'
} 