import { Polar } from '@polar-sh/sdk';

// Create a reusable Polar API client following the official documentation
// See: https://docs.polar.sh/guides/nextjs
// And: https://github.com/polarsource/polar-next-app

/**
 * Email type for Polar checkout
 */
export enum EmailType {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
}

/**
 * Creates a Polar SDK client instance
 * @param isProduction Whether to use production or sandbox tokens
 * @returns A Polar SDK client instance
 */
export const createPolarClient = (isProduction = false): Polar => {
  const token = 
    isProduction 
    ? process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN
    : process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN;

  // Print token status and first/last chars for debugging
  if (token) {
    // Only print first 5 and last 5 chars of token for security
    const maskedToken = `${token.substring(0, 5)}...${token.substring(token.length - 5)}`;
    console.log(`Using ${isProduction ? 'production' : 'sandbox'} token: ${maskedToken}`);
  } else {
    console.error(`CRITICAL ERROR: Missing ${isProduction ? 'GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN' : 'GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN'} environment variable`);
  }
  
  // Print any token formatting issues
  if (token && (token.startsWith(' ') || token.endsWith(' '))) {
    console.error('⚠️ TOKEN ERROR: Your token contains leading or trailing spaces which may cause authentication issues');
  }
  
  // Always explicitly set the server parameter
  const server = isProduction ? 'production' : 'sandbox';
  console.log(`Creating Polar client with server: ${server}`);
  
  return new Polar({
    accessToken: token?.trim() || '', // Trim the token to remove any whitespace
    server  // Explicitly set server parameter
  });
};

// Determine if we're in a sandbox environment
const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production' || 
                  process.env.NODE_ENV !== 'production';

// Export the initialized Polar client
export const polarApi = new Polar({
  accessToken: isSandbox 
    ? process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN?.trim() || ''
    : process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN?.trim() || '',
  server: isSandbox ? 'sandbox' : 'production'
}); 