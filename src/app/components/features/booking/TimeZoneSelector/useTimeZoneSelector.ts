'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'

// Define SelectOption locally
interface SelectOption {
  value: string;
  label: string;
}

// Define props for the hook
interface UseTimeZoneSelectorProps {
  currentTimezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function useTimeZoneSelector({
  currentTimezone,
  onTimezoneChange
}: UseTimeZoneSelectorProps) {
  
  // --- State ---
  const [open, setOpen] = useState(false);
  const [allTimezones, setAllTimezones] = useState<string[]>([]);

  // --- Effects ---
  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined') {
      try {
        setAllTimezones(Intl.supportedValuesOf('timeZone'));
      } catch (error) {
        console.error("Failed to get supported timezones:", error);
        // Provide a fallback list or handle error appropriately
        setAllTimezones(['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']); 
      }
    }
  }, []);

  // --- Memoized values ---
  const timezoneOptions: SelectOption[] = useMemo(() => {
    return allTimezones.map(zone => {
      let label = zone;
      try {
        const dt = DateTime.now().setZone(zone);
        const offset = dt.toFormat('ZZZZ');
        label = `${zone} (${offset})`;
      } catch {
        // If Luxon fails to set zone, use the zone name as label
      }
      return { value: zone, label };
    }).sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
  }, [allTimezones]);

  const currentTimezoneLabel = useMemo(() => {
    const currentOption = timezoneOptions.find(option => option.value === currentTimezone);
    return currentOption?.label || currentTimezone || "Select timezone";
  }, [currentTimezone, timezoneOptions]);

  // --- Callbacks ---
  const handleSelect = useCallback((selectedValue: string) => {
    onTimezoneChange(selectedValue);
    setOpen(false);
  }, [onTimezoneChange]);

  // --- Return values ---
  return {
    open,
    setOpen,
    timezoneOptions,
    currentTimezoneLabel,
    handleSelect
  };
} 