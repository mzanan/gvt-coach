import axios from 'axios';
import { BookingFrequency } from '@/types/enums';

interface BookingData {
  userEmail: string;
  bookingPlan?: {
    frequency?: string;
  };
  [key: string]: unknown;
}

export async function createLemonSqueezyCheckout(
  variantId: string, 
  bookingData: BookingData
): Promise<{ checkoutUrl: string; orderId: string }> {
  // Check required environment variables
  const storeId = process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_STORE_ID;
  const apiKey = process.env.GVT_COACH_LEMONSQUEEZY_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const apiBaseUrl = process.env.GVT_COACH_LEMONSQUEEZY_API_URL;
  
  if (!storeId) {
    console.error('Checkout API: Missing NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_STORE_ID environment variable');
    throw new Error('Server configuration error');
  }
  
  if (!apiKey) {
    console.error('Checkout API: Missing GVT_COACH_LEMONSQUEEZY_API_KEY environment variable');
    throw new Error('Server configuration error');
  }
  
  if (!appUrl) {
    console.error('Checkout API: Missing NEXT_PUBLIC_APP_URL environment variable');
    throw new Error('Server configuration error');
  }
  
  if (!apiBaseUrl) {
    console.error('Checkout API: Missing GVT_COACH_LEMONSQUEEZY_API_URL environment variable');
    throw new Error('Server configuration error');
  }

  // Prepare data for LemonSqueezy
  const checkoutData = {
    data: {
      type: 'checkouts',
      attributes: {
        store_id: storeId,
        variant_id: variantId,
        product_options: {
          redirect_url: `${appUrl}/payment/success`,
        },
        checkout_data: {
          email: bookingData?.userEmail,
          custom: {
            // Simplified custom data with key-value pairs
            user_email: bookingData?.userEmail,
            booking_frequency: bookingData?.bookingPlan?.frequency || BookingFrequency.Once
          }
        }
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: storeId
          }
        },
        variant: {
          data: {
            type: 'variants',
            id: String(variantId)
          }
        }
      }
    }
  };
  
  // Build the complete API URL
  const apiUrl = `${apiBaseUrl}/checkouts`;
  console.log(`Making API request to: ${apiUrl}`);
  
  try {
    const response = await axios.post(
      apiUrl,
      checkoutData,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${apiKey.trim()}`
        }
      }
    );

    console.log('LemonSqueezy successful response received');
    
    // Extract checkout URL and order ID
    const checkoutUrl = response.data?.data?.attributes?.url;
    const orderId = response.data?.data?.id;
    
    if (!checkoutUrl || !orderId) {
      console.error('Checkout API: Invalid response from LemonSqueezy', response.data);
      throw new Error('Failed to create checkout');
    }
    
    return { checkoutUrl, orderId };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('LemonSqueezy API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });

      // If we have a 422 error, provide more detailed information
      if (error.response.status === 422) {
        const errorDetails = error.response.data?.errors || [];
        const errorMessages = errorDetails.map((err: { title?: string; detail?: string }) => 
          `${err.title || 'Validation Error'}: ${err.detail || 'Unknown error'}`
        ).join('; ');
        
        console.error('Validation errors from LemonSqueezy:', errorMessages);
        throw new Error(`LemonSqueezy checkout validation failed: ${errorMessages || 'Invalid variant ID or store ID'}`);
      }
    }
    
    throw error;
  }
} 