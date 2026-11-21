import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  /* The root is the touch target, not the pill. A 36x20 pill is below the 44px
   * minimum, and small toggles are a classic mis-tap. Padding grows the
   * clickable box to 44x44 while the visual track stays 36x20 and the thumb
   * still travels the full width of the track. Negative margin keeps the
   * extra padding from shifting the surrounding layout.
   *
   * The thumb uses translate-x-[calc(100%+2px)] rather than a fixed 16px so
   * the travel distance stays correct if the track is ever resized. */
  <SwitchPrimitives.Root
    className={cn(
      "-m-3 inline-flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none relative flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent shadow-sm transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </span>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
