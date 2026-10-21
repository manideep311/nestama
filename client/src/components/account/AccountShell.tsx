"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, LogOut, MapPin, Package, PawPrint, ShieldCheck, UserRound } from "lucide-react";
import { signOutAndLeave, useSession } from "@/lib/auth-client";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/pets", label: "My pets", icon: PawPrint },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/profile", label: "Profile", icon: UserRound },
];

/** Admins reach the dashboard from their account too (sign-in already lands them there). */
const ADMIN_LINK = { href: "/admin", label: "Admin dashboard", icon: ShieldCheck };

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}

/**
 * Account frame: sidebar on desktop, a scrollable chip row on phones. Guests only ever reach the
 * wishlist page (the proxy sends them to sign in elsewhere), so they get the content alone.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, isPending } = useSession();

  if (!isPending && !data) return <div className="container-page py-8 md:py-12">{children}</div>;
  const links = data?.user.role === "ADMIN" ? [...NAV, ADMIN_LINK] : NAV;

  return (
    <div className="container-page grid gap-6 py-8 md:py-12 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <nav aria-label="Your account" className="min-w-0 lg:sticky lg:top-40 lg:self-start">
        <p className="mb-3 hidden text-xs font-bold tracking-[0.18em] text-muted uppercase lg:block">Your account</p>
        <ul className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors lg:rounded-2xl",
                    active ? "bg-forest text-cream" : "bg-white text-forest ring-1 ring-line hover:bg-sage lg:bg-transparent lg:ring-0",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => void signOutAndLeave()}
          className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-4 hidden text-muted lg:inline-flex" })}
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
