'use client'

import { createContext, useContext, ReactNode } from 'react';
import { AppConfig } from '@/config/appConfig';
import { COACHES_CONFIG } from '@/config/coaches';
import { SITE_CONFIG } from '@/config/site';

const DEFAULT_CONFIG: AppConfig = {
  coaches: COACHES_CONFIG,
  site: SITE_CONFIG,
  paymentProvider: 'stripe',
  meetingProvider: 'zoom',
};

const AppConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);

export function AppConfigProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}
