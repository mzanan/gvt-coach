'use client'

import { useState, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'

interface SelectOption {
  value: string;
  label: string;
}

interface UseTimeZoneSelectorProps {
  currentTimezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function useTimeZoneSelector({
  currentTimezone,
  onTimezoneChange
}: UseTimeZoneSelectorProps) {
  
  const [open, setOpen] = useState(false);
  const [allTimezones] = useState<string[]>(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (error) {
      console.error("Failed to get supported timezones:", error);
      return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    }
  });

  const timezoneOptions: SelectOption[] = useMemo(() => {
    return allTimezones.map(zone => {
      let label = zone;
      try {
        const dt = DateTime.now().setZone(zone);
        const offset = dt.toFormat('ZZZZ');
        label = `${zone} (${offset})`;
      } catch {
      }
      return { value: zone, label };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [allTimezones]);

  const currentTimezoneLabel = useMemo(() => {
    const currentOption = timezoneOptions.find(option => option.value === currentTimezone);
    return currentOption?.label || currentTimezone || "Select timezone";
  }, [currentTimezone, timezoneOptions]);

  const handleSelect = useCallback((selectedValue: string) => {
    onTimezoneChange(selectedValue);
    setOpen(false);
  }, [onTimezoneChange]);

  return {
    open,
    setOpen,
    timezoneOptions,
    currentTimezoneLabel,
    handleSelect
  };
} 