import { Suspense } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { categoryNav } from "@/lib/nav";
import { StickyHeader } from "./StickyHeader";
import { AnimatedSearch } from "@/components/search/AnimatedSearch";
import { CategoryNav } from "./CategoryNav";
import { MobileMenu } from "./MobileMenu";
import { CartButton } from "./CartButton";
import { AccountLink } from "./AccountLink";

export function Header({ popularSearches }: { popularSearches: string[] }) {
  return (
    <StickyHeader>
      <div className="container-page flex h-16 items-center gap-3 sm:h-20 sm:gap-5">
        <MobileMenu items={categoryNav} />
        <Logo introTarget className="mr-auto md:mr-0" />

        <div className="hidden flex-1 justify-center md:flex">
          <AnimatedSearch popular={popularSearches} />
        </div>

        <nav aria-label="Your account" className="flex items-center gap-0.5 sm:gap-1.5">
          <AccountLink className="hidden sm:flex" />
          <HeaderAction
            href="/account/wishlist"
            label="Wishlist"
            className="hidden sm:flex"
            icon={<Heart className="size-[22px]" aria-hidden="true" />}
          />
          <CartButton />
        </nav>
      </div>

      <div className="container-page pb-3 md:hidden">
        <AnimatedSearch popular={popularSearches} />
      </div>

      <div className="hidden border-t border-line lg:block">
        <Suspense fallback={<CategoryNav items={categoryNav} activeHref={null} />}>
          <CategoryNav items={categoryNav} />
        </Suspense>
      </div>
    </StickyHeader>
  );
}

/** Account/Wishlist are also in the mobile menu, so on phones the header keeps just the cart. */
function HeaderAction({ href, label, icon, className }: { href: string; label: string; icon: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-forest transition-colors hover:bg-sage sm:px-3",
        className,
      )}
    >
      {icon}
      <span className="sr-only xl:not-sr-only">{label}</span>
    </Link>
  );
}
