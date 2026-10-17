import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { YarnCurl } from "./icons";

interface Props {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
  aside?: ReactNode;
  className?: string;
}

export function SectionHeading({ id, eyebrow, title, subtitle, action, aside, className }: Props) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-8", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-ink uppercase">
            <YarnCurl className="h-3 w-8 text-orange" />
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="text-[1.75rem] leading-[1.1] font-extrabold sm:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {(action || aside) && (
        <div className="flex flex-wrap items-center gap-3">
          {aside}
          {action && (
            <Link
              href={action.href}
              className="group inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-orange-ink hover:text-forest"
            >
              {action.label}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
