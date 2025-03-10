import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { variantId, bookingData } = body;

    // Check required fields
    if (!variantId) {
      console.warn('Checkout API: Missing variant ID in request');
      return NextResponse.json(
        { error: 'variantId is required' },
        { status: 400 }
      );
    }
    
    // Check required environment variables
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!storeId || !apiKey || !appUrl) {
      console.error('Checkout API: Missing required environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    console.log('Checkout API: Creating checkout in LemonSqueezy', {
      variantId,
      storeId,
      userEmail: bookingData?.userEmail,
    });
    
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
            email: bookingData?.userEmail
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
    
    // Call LemonSqueezy API
    console.log('Sending data to LemonSqueezy:', JSON.stringify(checkoutData, null, 2));
    console.log('Using API key (masked):', apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : 'missing');
    
    try {
      const response = await axios.post(
        'https://api.lemonsqueezy.com/v1/checkouts',
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
        return NextResponse.json(
          { error: 'Failed to create checkout' },
          { status: 500 }
        );
      }
      
      console.log('Checkout API: Checkout created successfully', {
        orderId,
        checkoutUrl
      });
      
      // IMPORTANT: Create payments_status record immediately with PENDING status
      try {
        console.log('Creating payments_status record for orderId:', orderId);
        
        // Use the local API endpoint 
        const paymentUpdateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: orderId,
            bookingData: bookingData || null
          })
        });
        
        if (!paymentUpdateResponse.ok) {
          const errorText = await paymentUpdateResponse.text();
          console.error('Failed to create payments_status record:', errorText);
          throw new Error('Failed to create payments_status record');
        }
        
        const paymentUpdateResult = await paymentUpdateResponse.json();
        console.log('Payment status record created successfully:', paymentUpdateResult);
      } catch (updateError) {
        console.error('Checkout API: Error creating payment status record', updateError);
        // Continue with the process but log the error
        // We won't fail the checkout just because the payment status record creation failed
        // The user will still get their checkout URL and can complete the payment
      }
      
      // Return response with checkout URL and orderId
      return NextResponse.json({
        checkoutUrl,
        orderId,
        bookingData
      });
    } catch (error) {
      console.error('Checkout API: Error creating checkout', error);
      
      // Check if it's an Axios error to get more details
      if (axios.isAxiosError(error) && error.response) {
        console.error('Checkout API: Error response from LemonSqueezy', {
          status: error.response.status,
          data: error.response.data
        });
        
        // Log the detailed error information
        if (error.response.data?.errors) {
          console.error('Detailed error information:', error.response.data.errors);
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to create checkout' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Checkout API: Unexpected error', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 