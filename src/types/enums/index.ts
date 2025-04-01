// Enum defining available coaches
export enum Coach {
  MATIAS = 'MATIAS',
  GABRIEL = 'GABRIEL',
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