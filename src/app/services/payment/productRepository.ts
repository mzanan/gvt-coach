'use server';

import { Coach } from '@/app/config/coaches';
import { BookingFrequency } from '@/app/types/enums/booking';
import { cookies } from 'next/headers';

interface ProductInfo {
  id: string;
  variantId: string;
  price: number;
}

interface ProductCache {
  timestamp: number;
  products: Record<string, ProductInfo>;
}

// Cache expiration time - 24 hours in milliseconds
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Cookie name for product cache
const PRODUCT_CACHE_COOKIE = 'gvt_product_cache';

/**
 * Get product information based on coach and frequency
 */
export const getProductInfo = async (coach: Coach, frequency: BookingFrequency): Promise<ProductInfo> => {
  // First, try to get from cache
  const cachedProduct = getFromCache(coach, frequency);
  
  if (cachedProduct) {
    return cachedProduct;
  }
  
  // If not in cache, fetch from API
  try {
    const product = await fetchProductFromAPI(coach, frequency);
    
    // Add to cache
    addToCache(coach, frequency, product);
    
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    // Return fallback product based on coach prices
    return getFallbackProduct(coach, frequency);
  }
};

/**
 * Get cached product if available and not expired
 */
const getFromCache = (coach: Coach, frequency: BookingFrequency): ProductInfo | null => {
  try {
    const cookieStore = cookies();
    const cachedData = cookieStore.get(PRODUCT_CACHE_COOKIE);
    
    if (!cachedData?.value) {
      return null;
    }
    
    const cache: ProductCache = JSON.parse(cachedData.value);
    
    // Check if cache is expired
    if (Date.now() - cache.timestamp > CACHE_EXPIRATION) {
      return null;
    }
    
    const key = `${coach}_${frequency}`;
    return cache.products[key] || null;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

/**
 * Add product to cache
 */
const addToCache = (coach: Coach, frequency: BookingFrequency, product: ProductInfo): void => {
  try {
    const cookieStore = cookies();
    const cachedData = cookieStore.get(PRODUCT_CACHE_COOKIE);
    
    let cache: ProductCache;
    
    if (cachedData?.value) {
      cache = JSON.parse(cachedData.value);
    } else {
      cache = {
        timestamp: Date.now(),
        products: {}
      };
    }
    
    const key = `${coach}_${frequency}`;
    cache.products[key] = product;
    
    // Update timestamp
    cache.timestamp = Date.now();
    
    // Save to cookie
    // Note: In a real implementation, consider using server-side database instead
    // of cookies for larger caches
    cookieStore.set(PRODUCT_CACHE_COOKIE, JSON.stringify(cache), {
      maxAge: CACHE_EXPIRATION / 1000, // Convert to seconds
      path: '/',
    });
  } catch (error) {
    console.error('Error adding to cache:', error);
  }
};

/**
 * Fetch product from API (Polar or LemonSqueezy)
 */
const fetchProductFromAPI = async (coach: Coach, frequency: BookingFrequency): Promise<ProductInfo> => {
  // Determine which API to use based on environment variable
  const paymentProvider = process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER?.toLowerCase() || 'lemonsqueezy';
  
  if (paymentProvider === 'polar') {
    return fetchFromPolarAPI(coach, frequency);
  } else {
    return fetchFromLemonSqueezyAPI(coach, frequency);
  }
};

/**
 * Fetch product from Polar API
 */
const fetchFromPolarAPI = async (coach: Coach, frequency: BookingFrequency): Promise<ProductInfo> => {
  // Implementation for Polar API
  // In a real implementation, you would fetch from Polar API using their SDK or REST API
  
  // For now, return fallback product
  return getFallbackProduct(coach, frequency);
};

/**
 * Fetch product from LemonSqueezy API
 */
const fetchFromLemonSqueezyAPI = async (coach: Coach, frequency: BookingFrequency): Promise<ProductInfo> => {
  // Implementation for LemonSqueezy API
  // In a real implementation, you would fetch from LemonSqueezy API
  
  // For now, return fallback product
  return getFallbackProduct(coach, frequency);
};

/**
 * Get fallback product based on coach and frequency
 */
const getFallbackProduct = (coach: Coach, frequency: BookingFrequency): ProductInfo => {
  // Generate consistent IDs based on coach and frequency
  const id = `${coach.toLowerCase()}_${frequency.toLowerCase()}`;
  const variantId = `${id}_variant`;
  
  let price = 0;
  
  // Get prices from constants
  if (coach === Coach.Matias) {
    if (frequency === BookingFrequency.Once) {
      price = 50;
    } else if (frequency === BookingFrequency.Weekly) {
      price = 200;
    } else if (frequency === BookingFrequency.TwiceWeekly) {
      price = 350;
    }
  } else if (coach === Coach.Gabriel) {
    if (frequency === BookingFrequency.Once) {
      price = 100;
    } else if (frequency === BookingFrequency.Weekly) {
      price = 400;
    } else if (frequency === BookingFrequency.TwiceWeekly) {
      price = 700;
    }
  }
  
  return { id, variantId, price };
}; 