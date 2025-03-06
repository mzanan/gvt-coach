'use client';

import { useEmailNotifications } from './useEmailNotifications';

export interface EmailNotificationsProps {
  children?: React.ReactNode;
}

export function EmailNotifications({ children }: EmailNotificationsProps) {
  // Solo utilizamos el hook para exponerlo a través del componente
  useEmailNotifications();
  
  return (
    <>{children}</>
  );
} 