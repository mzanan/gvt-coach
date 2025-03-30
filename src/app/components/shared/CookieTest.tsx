'use client';

import { useState, useEffect } from 'react';
import { getClientCookie, setClientCookie, deleteClientCookie } from '@/lib/utils/cookies';

export default function CookieTest() {
  const [cookieValue, setCookieValue] = useState<string>('');
  const [savedCookies, setSavedCookies] = useState<Record<string, any>>({});

  // Check if cookies are set on component mount
  useEffect(() => {
    checkCookies();
  }, []);

  const checkCookies = () => {
    const userData = getClientCookie('user_data');
    const testCookie = getClientCookie('test_cookie');
    
    setSavedCookies({
      user_data: userData,
      test_cookie: testCookie
    });
  };

  const handleSetCookie = () => {
    if (!cookieValue) return;
    
    setClientCookie('test_cookie', cookieValue);
    setTimeout(() => checkCookies(), 300);
  };

  const handleDeleteCookie = (name: string) => {
    deleteClientCookie(name);
    setTimeout(() => checkCookies(), 300);
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-bold mb-4">Cookie Test Panel</h2>
      
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={cookieValue} 
            onChange={(e) => setCookieValue(e.target.value)}
            placeholder="Enter value for test_cookie" 
            className="px-3 py-2 border rounded"
          />
          <button 
            onClick={handleSetCookie}
            className="bg-blue-500 text-white px-3 py-2 rounded"
          >
            Set Cookie
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="font-medium">Saved Cookies:</h3>
        
        {Object.entries(savedCookies).map(([name, value]) => (
          <div key={name} className="border p-2 rounded flex justify-between items-center">
            <div>
              <span className="font-medium">{name}:</span> 
              <span className="ml-2">{value ? JSON.stringify(value) : 'Not set'}</span>
            </div>
            {value && (
              <button 
                onClick={() => handleDeleteCookie(name)}
                className="bg-red-500 text-white px-2 py-1 text-sm rounded"
              >
                Delete
              </button>
            )}
          </div>
        ))}
        
        <button 
          onClick={checkCookies}
          className="mt-2 bg-gray-200 px-3 py-2 rounded"
        >
          Refresh Cookie List
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Cookie Storage Debug:</p>
        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-24">
          {typeof document !== 'undefined' ? document.cookie : 'Server-side rendering'}
        </pre>
      </div>
    </div>
  );
} 