import { PaymentOrderStatus } from '@/types/enums/booking';

/**
 * Checks the Polar order status via API
 */
export async function checkPolarOrderStatus(orderId: string) {
  try {
    console.log("Checking Polar order status manually for order:", orderId);
    
    const response = await fetch(`/api/orders/${orderId}?provider=polar`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const orderData = await response.json();
      console.log("Polar order API response:", {
        orderId,
        status: orderData.status,
        source: orderData.source,
        provider: orderData.provider,
        hasPaymentDetails: !!orderData.paymentDetails
      });
      
      // Return true if the order is paid - check multiple possible status values
      const isPaid = 
        orderData.status === PaymentOrderStatus.Paid || 
        orderData.status === PaymentOrderStatus.Active || 
        orderData.status === PaymentOrderStatus.Completed;
      
      console.log(`Polar order status check result: ${isPaid ? PaymentOrderStatus.Paid : 'NOT PAID'}, status=${orderData.status}`);
      return isPaid;
    } else {
      const errorText = await response.text();
      console.error("Error checking Polar order:", {
        orderId,
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      return false;
    }
  } catch (e) {
    console.error("Error calling order status API:", e);
    return false;
  }
} 