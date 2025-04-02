"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
import { useTimeZoneSelector } from './useTimeZoneSelector'

interface TimeZoneSelectorProps {
  currentTimezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function TimeZoneSelector(props: TimeZoneSelectorProps) {
  const {
    open,
    setOpen,
    timezoneOptions,
    currentTimezoneLabel,
    handleSelect
  } = useTimeZoneSelector(props);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between max-w-xs w-full"
          size="sm"
        >
          <span className="truncate">
            {currentTimezoneLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command filter={(value, search) => {
          const option = timezoneOptions.find(opt => opt.value === value);
          const label = option?.label || value;
          if (label.toLowerCase().includes(search.toLowerCase())) return 1;
          return 0;
        }}>
          <CommandInput placeholder="Search timezone..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {timezoneOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      props.currentTimezone === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default TimeZoneSelector; 