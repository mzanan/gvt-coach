import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { Label } from '@/app/components/ui-kit/label';

interface TimezoneDropdownProps {
  selectedTimezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function TimezoneDropdown({ selectedTimezone, onTimezoneChange }: TimezoneDropdownProps) {
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    setTimezones(Intl.supportedValuesOf('timeZone'));
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <select
        id="timezone"
        value={selectedTimezone}
        onChange={(e) => onTimezoneChange(e.target.value)}
        className="w-full p-2 border rounded-md bg-background text-sm"
      >
        {timezones.map((zone) => {
          // Crear un objeto DateTime en esta zona horaria
          const dt = DateTime.now().setZone(zone);
          // Formatear el offset para mostrar (ejemplo: UTC+1, UTC-5)
          const offset = dt.toFormat('ZZZZ');
          
          return (
            <option key={zone} value={zone}>
              {`${zone} (${offset})`}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default TimezoneDropdown; 