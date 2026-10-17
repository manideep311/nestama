"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/** Header account entry: the shopper's first name when signed in, "Sign in" otherwise. */
export function AccountLink({ className }: { className?: string }) {
  const { data, isPending } = useSession();
  const first = data?.user.name.split(" ")[0];
  const label = isPending ? "Account" : first ? `Hi, ${first}` : "Sign in";

  return (
    <Link
      href={data ? "/account" : "/login"}
      aria-label={data ? `Your account (${data.user.name})` : isPending ? "Account" : "Sign in"}
      className={cn(
        "flex h-11 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-forest transition-colors hover:bg-sage sm:px-3",
        className,
      )}
    >
      <UserRound className="size-[22px]" aria-hidden="true" />
      <span className="sr-only max-w-[9rem] truncate xl:not-sr-only">{label}</span>
    </Link>
  );
}
