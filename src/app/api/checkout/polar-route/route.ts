import { Checkout } from "@polar-sh/nextjs";
import { Polar } from '@polar-sh/sdk';
import { NextRequest, NextResponse } from 'next/server';

// Use environment variables for configuration without hardcoding defaults
// Will throw an error if missing, which is intended for proper validation
export const GET = Checkout({
  accessToken: process.env.NEXT_PUBLIC_ENV === 'production' 
    ? process.env.POLAR_PRODUCTION_ACCESS_TOKEN as string
    : process.env.POLAR_SANDBOX_ACCESS_TOKEN as string,
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
  server: process.env.NEXT_PUBLIC_ENV === 'production' ? 'production' : 'sandbox'
});

export async function POST(request: NextRequest) {
  const token = request.headers.get('host')?.includes('gvt.academy')
    ? process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN as string
    : process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN as string;
  
  const polarClient = new Polar({ accessToken: token });
  
  try {
    const { productId } = await request.json();
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }
    
    // Use the checkouts API to create a session
    const checkoutSession = await polarClient.checkouts.create({
      productId: productId,
      successUrl: `${new URL(request.url).origin}/payment/success`,
    });
    
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating Polar checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 