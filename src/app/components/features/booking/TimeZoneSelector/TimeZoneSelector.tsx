"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useState, useEffect } from "react"
import { DateTime } from "luxon"
import { Button } from "@/app/components/ui-kit/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui-kit/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui-kit/popover"
import { cn } from "@/lib/utils"

interface TimeZoneSelectorProps {
  currentTimezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function TimeZoneSelector({ 
  currentTimezone, 
  onTimezoneChange 
}: TimeZoneSelectorProps) {
  const [open, setOpen] = useState(false)
  const [timezones, setTimezones] = useState<string[]>([]);
  
  useEffect(() => {
    // Get all supported timezones from Intl API
    setTimezones(Intl.supportedValuesOf('timeZone'));
  }, []);
  
  // Find formatted version of current timezone
  const getCurrentTimezoneLabel = () => {
    if (!currentTimezone) return "Select timezone";
    try {
      const dt = DateTime.now().setZone(currentTimezone);
      const offset = dt.toFormat('ZZZZ');
      return `${currentTimezone} (${offset})`;
    } catch {
      return currentTimezone;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-[250px]"
          size="sm"
        >
          {getCurrentTimezoneLabel()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {timezones.map((zone) => {
                // Create DateTime object in this timezone
                const dt = DateTime.now().setZone(zone);
                // Format the offset (e.g., UTC+1, UTC-5)
                const offset = dt.toFormat('ZZZZ');
                const label = `${zone} (${offset})`;
                
                return (
                  <CommandItem
                    key={zone}
                    value={zone}
                    onSelect={(currentValue) => {
                      onTimezoneChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        currentTimezone === zone ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default TimeZoneSelector; 