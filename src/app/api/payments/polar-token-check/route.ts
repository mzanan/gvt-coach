import { createPolarClient } from '@/lib/utils/polar';
import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check if the Polar token is valid
 * This is useful for troubleshooting token issues without going through the entire checkout process
 */
export async function GET() {
  try {
    // Determine if we should use sandbox or production
    const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production';
    const environment = isSandbox ? 'sandbox' : 'production';
    
    // Get the appropriate token
    const tokenEnvVar = isSandbox 
      ? 'GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN'
      : 'GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN';
    
    const token = process.env[tokenEnvVar];
    
    if (!token) {
      return NextResponse.json({
        valid: false,
        error: `Missing ${tokenEnvVar} environment variable`,
        environment
      }, { status: 500 });
    }
    
    // Create the Polar client
    const polarClient = createPolarClient(!isSandbox);
    
    try {
      // Make a simple API call to validate the token
      // If the token is invalid, this will throw an error
      // We're not using the response data, just checking if the call succeeds
      await polarClient.products.list({ page: 1 });
      
      // If we get here, the token is valid
      return NextResponse.json({
        valid: true,
        environment,
        message: 'Polar API token is valid'
      });
    } catch (apiError: unknown) {
      // Check for authentication errors
      if (apiError instanceof Error && 
          apiError.message.includes('expired, revoked, malformed, or invalid')) {
        return NextResponse.json({
          valid: false,
          environment,
          error: 'Token authentication failed',
          message: 'The access token provided is expired, revoked, malformed, or invalid for other reasons',
          solution: 'Generate a new access token in the Polar dashboard and update your environment variables'
        }, { status: 401 });
      }
      
      // Other API errors
      return NextResponse.json({
        valid: false,
        environment,
        error: apiError instanceof Error ? apiError.message : 'Unknown API error',
        solution: 'Check the Polar API documentation and your token permissions'
      }, { status: 500 });
    }
  } catch (error: unknown) {
    // Unexpected errors
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
      solution: 'Check the server logs for more details'
    }, { status: 500 });
  }
} 