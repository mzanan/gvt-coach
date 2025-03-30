import { cookies } from 'next/headers';

/**
 * Utilidad para manejar cookies del lado del servidor usando la API nativa de Next.js 15
 */

// Obtener una cookie en el servidor
export async function getServerCookie(name: string) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(name);
    
    if (!cookie) return null;
    
    try {
      return JSON.parse(cookie.value);
    } catch (e) {
      // If we can't parse JSON, return the raw value
      return cookie.value;
    }
  } catch (error) {
    console.error(`Error al obtener la cookie ${name}:`, error);
    return null;
  }
}

// Establecer una cookie en el servidor (para usar en Server Actions o Route Handlers)
export async function setServerCookie(name: string, value: unknown, options: { 
  maxAge?: number; 
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
} = {}) {
  try {
    const cookieStore = await cookies();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Set default path if not provided
    if (!options.path) {
      options.path = '/';
    }
    
    // Default to Secure in production
    if (process.env.NODE_ENV === 'production' && options.secure === undefined) {
      options.secure = true;
    }
    
    // Default to httpOnly
    if (options.httpOnly === undefined) {
      options.httpOnly = true;
    }
    
    cookieStore.set(name, stringValue, options);
  } catch (error) {
    console.error(`Error al establecer la cookie ${name}:`, error);
  }
}

// Eliminar una cookie en el servidor
export async function deleteServerCookie(name: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(name);
  } catch (error) {
    console.error(`Error al eliminar la cookie ${name}:`, error);
  }
} 