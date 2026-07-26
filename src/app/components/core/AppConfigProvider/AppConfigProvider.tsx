'use client'

import { createContext, useContext, ReactNode } from 'react';
import { AppConfig } from '@/config/appConfig';
import { COACHES_CONFIG } from '@/config/coaches';
import { SITE_CONFIG } from '@/config/site';
import { CoachRecord } from '@/types/coach';

function defaultCoaches(): Record<string, CoachRecord> {
  const result: Record<string, CoachRecord> = {};
  for (const [id, coach] of Object.entries(COACHES_CONFIG)) {
    result[id] = {
      ...coach,
      id,
      paymentProvider: coach.paymentProvider || 'stripe',
      meetingProvider: coach.meetingProvider || 'zoom',
      polarProductId: coach.polarProductId || '',
    };
  }
  return result;
}

const DEFAULT_CONFIG: AppConfig = {
  coaches: defaultCoaches(),
  site: SITE_CONFIG,
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
