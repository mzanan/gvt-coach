"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/app/components/ui-kit/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "flex h-control items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "opacity-60 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "opacity-60 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 text-center text-xs font-normal leading-6 text-muted-foreground",
        week: "flex w-full",
        day: "flex-1 p-0 text-center text-sm",
        day_button: cn(
          "mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-md p-0 font-normal",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
        today: "[&>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left"
            ? <ChevronLeft className="size-4" {...chevronProps} />
            : <ChevronRight className="size-4" {...chevronProps} />,
        CaptionLabel: (labelProps) => <h3 {...labelProps} role={undefined} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
