import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  /* The track has to be the Radix Root itself, not a child of it. Radix puts
   * data-state on the Root, and the checked/unchecked background is selected
   * with data-[state=checked]:bg-primary on that same element. Wrapping the
   * Root in a padded box and moving the track onto an inner span silently
   * dropped both backgrounds, leaving a transparent pill with a floating
   * thumb.
   *
   * So the Root stays the track at its natural 36x20, and the 44px touch
   * target comes from a ::before overlay that extends past the visual bounds.
   * The overlay is part of the button, so it is tappable, but it adds no
   * layout size -- the switch still occupies 36x20 in the flow. */
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors before:absolute before:-inset-3 before:rounded-full before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
