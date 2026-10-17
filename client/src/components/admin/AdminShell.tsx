"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  Percent,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Tag,
  TicketPercent,
  Users,
  X,
} from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { Logo } from "@/components/ui/Logo";
import { AdminAccess } from "@/lib/admin-client";
import { cn } from "@/lib/cn";

const NAV = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    group: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquareText },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: ShoppingBag },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/brands", label: "Brands", icon: Tag },
    ],
  },
  {
    group: "Marketing",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: Percent },
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
    ],
  },
  { group: "Store", items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
];

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV.map(({ group, items }) => (
        <div key={group}>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.16em] text-cream/70 uppercase">{group}</p>
          <ul className="space-y-0.5">
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname !== null && isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                      active
                        ? "bg-cream/12 text-cream before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-orange"
                        : "text-cream/75 hover:bg-cream/8 hover:text-cream",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function CurrentNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

/** The nav, highlighted for the current page. The path is request data on dynamic routes, so it streams. */
function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
      <CurrentNav onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarFooter({ name, onSignOut }: { name?: string; onSignOut: () => void }) {
  return (
    <div className="space-y-1 border-t border-cream/10 p-3">
      {name ? (
        <p className="truncate px-3 pb-1 text-xs text-cream/60">Signed in as {name}</p>
      ) : (
        <div className="mx-3 mb-2 h-3 w-32 rounded bg-cream/10" aria-hidden="true" />
      )}
      <Link
        href="/"
        className="flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-cream/80 hover:bg-cream/8 hover:text-cream"
      >
        <ExternalLink className="size-4" aria-hidden="true" /> View store
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-cream/80 hover:bg-cream/8 hover:text-cream"
      >
        <LogOut className="size-4" aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}

/**
 * Admin frame: forest sidebar on desktop, top bar + drawer on phones. While the session loads the
 * frame and page render as skeletons (their reads wait on `AdminAccess`); non-admins see "No access".
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isPending, error, refetch } = useSession();
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (drawer && !d.open) d.showModal();
    if (!drawer && d.open) d.close();
  }, [drawer]);

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/");
  };

  const isAdmin = data?.user.role === "ADMIN";

  // A failed session check (API restarting, offline) isn't the same as being signed out.
  if (!isPending && !data && error) {
    return (
      <main id="main" className="grid min-h-dvh place-items-center bg-cream px-4 text-center">
        <div className="max-w-md" role="alert">
          <h1 className="text-3xl font-extrabold">Couldn&apos;t check your session</h1>
          <p className="mt-2 text-muted">The store server didn&apos;t answer. It may be restarting; try again in a moment.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 font-bold text-cream"
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      </main>
    );
  }

  if (!isPending && !isAdmin) {
    return (
      <main id="main" className="grid min-h-dvh place-items-center bg-cream px-4 text-center">
        <div className="max-w-md">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-peach text-orange-ink">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-extrabold">No access</h1>
          <p className="mt-2 text-muted">
            {data ? `${data.user.email} isn't an admin account.` : "Sign in with an admin account to manage the store."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={data ? "/" : "/login?next=/admin"}
              className="inline-flex h-11 items-center rounded-full bg-forest px-5 font-bold text-cream"
            >
              {data ? "Back to the store" : "Sign in"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[15.5rem_1fr]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col bg-forest text-cream lg:flex">
        <div className="flex flex-col items-start gap-2 px-5 pt-5 pb-2">
          <Logo tone="light" size="sm" withTagline={false} />
          <span className="rounded-md bg-orange px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-charcoal uppercase">
            Admin
          </span>
        </div>
        <AdminNav />
        <SidebarFooter name={data?.user.name} onSignOut={signOut} />
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="grid size-10 place-items-center rounded-full text-forest hover:bg-sage"
            aria-label="Open admin menu"
            aria-haspopup="dialog"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
          <span className="text-sm font-extrabold tracking-wide text-forest">NESTAMA Admin</span>
          <Link href="/" className="text-xs font-bold text-orange-ink">
            Store
          </Link>
        </div>

        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8" aria-busy={isPending || undefined}>
          <AdminAccess value={isAdmin}>{children}</AdminAccess>
        </main>
      </div>

      <dialog
        ref={drawerRef}
        onClose={() => setDrawer(false)}
        aria-label="Admin menu"
        className="admin-drawer bg-forest text-cream"
        onClick={(e) => e.target === e.currentTarget && setDrawer(false)}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pt-4">
            <Logo tone="light" size="sm" withTagline={false} />
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="grid size-10 place-items-center rounded-full hover:bg-cream/10"
              aria-label="Close admin menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <AdminNav onNavigate={() => setDrawer(false)} />
          <SidebarFooter name={data?.user.name} onSignOut={signOut} />
        </div>
      </dialog>
    </div>
  );
}
