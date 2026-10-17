import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Brand files are pre-sized static WebP; the global image loader only resizes CDN images, so these
// are served as-is (`unoptimized`).

/** The NESTAMA house mark (golden dog + tabby cat at home), cut from the brand film. */
export function LogoMark({
  className,
  eager = false,
  introTarget = false,
}: {
  className?: string;
  eager?: boolean;
  introTarget?: boolean;
}) {
  return (
    <Image
      src="/brand/nestama-mark.webp"
      alt=""
      width={433}
      height={300}
      loading={eager ? "eager" : "lazy"}
      className={cn("h-11 w-auto shrink-0 select-none", className)}
      draggable={false}
      unoptimized
      data-intro-target={introTarget ? "mark" : undefined}
    />
  );
}

/**
 * Horizontal lockup for headers and footers: mark + NESTAMA wordmark + tagline.
 * `tone="light"` swaps in the cream wordmark for dark (forest) backgrounds. `introTarget` marks the
 * pieces the intro film's logo flies into (the header only).
 */
export function Logo({
  withTagline = true,
  className,
  tone = "dark",
  size = "md",
  introTarget = false,
}: {
  withTagline?: boolean;
  className?: string;
  tone?: "dark" | "light";
  /** `sm` fits narrow places such as the admin sidebar (about 170px wide instead of 225px). */
  size?: "md" | "sm";
  introTarget?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2 rounded-xl", className)}
      aria-label="NESTAMA — Your True Friend, home"
    >
      <span className={cn("grid shrink-0 place-items-center", tone === "light" && "rounded-2xl bg-cream px-1.5 py-1")}>
        <LogoMark
          eager
          introTarget={introTarget}
          className={cn("transition-transform duration-300 ease-spring group-hover:-rotate-3", size === "sm" ? "h-9" : "h-10 sm:h-12")}
        />
      </span>
      <span className="flex flex-col items-start">
        <Image
          src={tone === "dark" ? "/brand/nestama-wordmark.webp" : "/brand/nestama-wordmark-light.webp"}
          alt=""
          width={781}
          height={144}
          loading="eager"
          // object-contain: if a tight container ever squeezes it, it scales instead of distorting.
          className={cn("w-auto object-contain object-left select-none", size === "sm" ? "h-[18px]" : "h-[21px] sm:h-[25px]")}
          draggable={false}
          unoptimized
          data-intro-target={introTarget ? "word" : undefined}
        />
        {withTagline && (
          <span
            data-intro-target={introTarget ? "tag" : undefined}
            className={cn(
              "mt-1 text-[0.56rem] leading-none font-bold tracking-[0.3em] whitespace-nowrap uppercase sm:text-[0.6rem]",
              tone === "dark" ? "text-forest/80" : "text-cream/80",
            )}
          >
            Your True Friend
          </span>
        )}
      </span>
    </Link>
  );
}

/** The full stacked logo (as it appears at the end of the brand film). */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/nestama-logo.webp"
      alt="NESTAMA — Your True Friend"
      width={781}
      height={483}
      className={cn("h-auto w-64 select-none", className)}
      draggable={false}
      unoptimized
    />
  );
}
