'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Import global styles
import '@/app/globals.css';

// Main component that renders the application
const MainApp: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    
    // Verify authentication
    const checkAuth = async () => {
      const supabase = createClientComponentClient({
        supabaseUrl: window.ENV_SUPABASE_URL,
        supabaseKey: window.ENV_SUPABASE_ANON_KEY,
      });
      
      await supabase.auth.getSession();
    };
    
    checkAuth();
  }, []);
  
  // Only render on client to avoid hydration errors
  if (!isClient) return null;
  
  // Decide which page to show based on authentication
  return (
    <div className="gvt-coach-main">
      {/* Import the main page component */}
      {/* This is a simplified version of the content from app/page.tsx */}
      <div className="container flex flex-col items-center justify-center min-h-screen py-12">
        <h1 className="text-4xl font-bold mb-8">GVT Coach</h1>
        {/* Here goes the main application content */}
        <div className="grid gap-6">
          {/* Application-specific components */}
        </div>
      </div>
    </div>
  );
};

export default MainApp; 