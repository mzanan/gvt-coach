import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    // Get basic configuration
    const storeId = process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.GVT_COACH_LEMONSQUEEZY_API_KEY;
    const apiBaseUrl = process.env.GVT_COACH_LEMONSQUEEZY_API_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    // Get variant ID (we'll try to use a hardcoded value for testing)
    const variantId = process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID || "679229";
    
    // Show configuration details
    console.log('LemonSqueezy Test API Configuration:', {
      apiBaseUrl,
      storeId,
      variantId,
      hasApiKey: !!apiKey,
      appUrl
    });
    
    // Check if we have all required configuration
    if (!storeId || !apiKey || !apiBaseUrl || !appUrl) {
      return NextResponse.json({
        error: 'Missing required environment variables',
        config: {
          hasStoreId: !!storeId,
          hasApiKey: !!apiKey,
          hasApiBaseUrl: !!apiBaseUrl,
          hasAppUrl: !!appUrl
        }
      }, { status: 500 });
    }
    
    // Generate a temporary order ID
    const tempOrderId = `temp_${Date.now()}`;
    
    // Create a minimal checkout request
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
            email: "test@example.com",
            custom: {
              checkout_order_id: tempOrderId
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
    
    console.log('Sending test data to LemonSqueezy:', JSON.stringify(checkoutData, null, 2));
    
    // Build the API URL
    const apiUrl = `${apiBaseUrl}/checkouts`;
    console.log(`Making test API request to: ${apiUrl}`);
    
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
      
      console.log('LemonSqueezy test checkout response:', response.status);
      
      // Return the successful response
      return NextResponse.json({
        success: true,
        data: response.data,
        checkoutUrl: response.data?.data?.attributes?.url
      });
      
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('LemonSqueezy API Test Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
        
        return NextResponse.json({
          error: 'LemonSqueezy API returned an error',
          status: error.response.status,
          details: error.response.data
        }, { status: 500 });
      }
      
      console.error('LemonSqueezy Test API Error:', error);
      return NextResponse.json({
        error: 'Failed to create test checkout',
        message: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Test API Error:', error);
    return NextResponse.json({
      error: 'Unexpected error in test API',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 