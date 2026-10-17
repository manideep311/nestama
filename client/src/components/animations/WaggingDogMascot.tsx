import { cn } from "@/lib/cn";
import { DogMascot } from "./DogMascot";

const sizes = { sm: "size-14", md: "size-24", lg: "size-36" } as const;

/**
 * Still dog that wags three times whenever `play` increments (0 = idle). Keying on `play`
 * restarts the CSS animation; reduced motion is handled in animations.css.
 */
export function WaggingDogMascot({ play, size = "md", className }: { play: number; size?: keyof typeof sizes; className?: string }) {
  return <DogMascot key={play} wagging={play > 0} className={cn(sizes[size], className)} />;
}
