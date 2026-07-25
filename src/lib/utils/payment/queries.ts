export async function fetchBookingByOrderId(checkoutOrderId: string) {
  try {
    if (!checkoutOrderId) {
      console.warn('Cannot fetch booking: checkout order ID is missing');
      return null;
    }

    const response = await fetch(`/api/bookings/by-order/${encodeURIComponent(checkoutOrderId)}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching booking:', error);
    return null;
  }
}

export async function fetchPaymentMapping(checkoutOrderId: string) {
  try {
    if (!checkoutOrderId) {
      console.warn('Cannot fetch payment mapping: checkout order ID is missing');
      return null;
    }

    const response = await fetch(`/api/payments/mapping/${encodeURIComponent(checkoutOrderId)}`);

    if (!response.ok) {
      console.warn('No payment mapping found');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching payment mapping:', error);
    return null;
  }
}

export async function fetchPaymentStatus(paymentStatusId: string) {
  try {
    if (!paymentStatusId) {
      console.warn('Cannot fetch payment status: payment status ID is missing');
      return null;
    }

    const response = await fetch(`/api/payments/status/${encodeURIComponent(paymentStatusId)}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return null;
  }
}
