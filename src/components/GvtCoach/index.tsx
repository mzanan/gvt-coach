'use client';

import React, { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import MainApp from './MainApp';

export interface GvtCoachProps {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  customConfig?: {
    theme?: 'light' | 'dark' | 'system';
    [key: string]: unknown;
  };
}

export const GvtCoach: React.FC<GvtCoachProps> = ({
  supabaseUrl,
  supabaseAnonKey,
  customConfig = {}
}) => {
  useEffect(() => {
    // Environment variables can be configured from props
    if (supabaseUrl) {
      window.ENV_SUPABASE_URL = supabaseUrl;
    }
    if (supabaseAnonKey) {
      window.ENV_SUPABASE_ANON_KEY = supabaseAnonKey;
    }
    
    // Other custom configurations
    if (customConfig) {
      window.GVT_COACH_CONFIG = customConfig;
    }
  }, [supabaseUrl, supabaseAnonKey, customConfig]);

  return (
    <ThemeProvider defaultTheme={customConfig.theme || 'system'} attribute="class">
      <div className="gvt-coach-container">
        <div className="gvt-coach-content">
          <MainApp />
        </div>
      </div>
    </ThemeProvider>
  );
};

// For TypeScript, we define that window can have these properties
declare global {
  interface Window {
    ENV_SUPABASE_URL?: string;
    ENV_SUPABASE_ANON_KEY?: string;
    GVT_COACH_CONFIG?: Record<string, unknown>;
  }
}

export default GvtCoach; 