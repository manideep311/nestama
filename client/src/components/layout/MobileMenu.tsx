"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ChevronRight, Heart, Menu, Package, UserRound, X } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { Logo } from "@/components/ui/Logo";
import { PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { signOutAndLeave, useSession } from "@/lib/auth-client";
import { buttonClasses } from "@/components/ui/Button";

const noopSubscribe = () => () => {};

/** Off-canvas category menu for < lg screens. Focus-trapped, Escape to close. */
export function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const reduce = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="-ml-2 grid size-11 place-items-center rounded-full text-forest hover:bg-sage lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
        <span className="sr-only">Open menu</span>
      </button>

      {/* Portalled to <body>: the header's backdrop-filter would otherwise become the
          containing block for this fixed overlay and clip it to the header's height. */}
      {isClient &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[70] lg:hidden">
                <m.div
                  className="absolute inset-0 bg-forest-900/45 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setOpen(false)}
                />
                <m.div
                  ref={panelRef}
                  id="mobile-menu"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu"
                  className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-cream paw-pattern shadow-lift"
                  initial={reduce ? { opacity: 0 } : { x: "-100%" }}
                  animate={reduce ? { opacity: 1 } : { x: 0 }}
                  exit={reduce ? { opacity: 0 } : { x: "-100%" }}
                  transition={{ type: "tween", duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <Logo />
                    <button
                      type="button"
                      data-autofocus
                      onClick={() => setOpen(false)}
                      className="grid size-11 place-items-center rounded-full text-forest hover:bg-sage"
                    >
                      <X className="size-6" aria-hidden="true" />
                      <span className="sr-only">Close menu</span>
                    </button>
                  </div>

                  <nav aria-label="Shop by category" className="flex-1 overflow-y-auto px-3 py-4">
                    <ul className="space-y-0.5">
                      {items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center justify-between rounded-2xl px-3 py-3 text-[17px] font-bold",
                              item.accent ? "text-orange-ink" : "text-forest",
                              "hover:bg-white active:scale-[0.99]",
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <PawIcon className={cn("size-4", item.accent ? "text-orange" : "text-forest/25")} />
                              {item.label}
                            </span>
                            <ChevronRight className="size-5 text-forest/40" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>

                  <MenuAccountRow onNavigate={() => setOpen(false)} />
                  <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                    {[
                      { href: "/account", label: "Account", icon: UserRound },
                      { href: "/account/wishlist", label: "Wishlist", icon: Heart },
                      { href: "/account/orders", label: "Orders", icon: Package },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className="flex flex-col items-center gap-1 rounded-2xl bg-white py-3 text-xs font-bold text-forest shadow-card"
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </m.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Who's signed in (with Sign out), or the way in for guests. */
function MenuAccountRow({ onNavigate }: { onNavigate: () => void }) {
  const { data, isPending } = useSession();
  if (isPending) return <div className="h-[4.25rem] border-t border-line" aria-hidden="true" />;

  if (!data) {
    return (
      <div className="flex items-center gap-2 border-t border-line p-3">
        <Link href="/login" onClick={onNavigate} className={buttonClasses({ variant: "forest", size: "md", className: "flex-1" })}>
          Sign in
        </Link>
        <Link href="/register" onClick={onNavigate} className={buttonClasses({ variant: "ghost", size: "md", className: "flex-1" })}>
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line p-3">
      <p className="min-w-0 truncate text-sm text-muted">
        Signed in as <span className="font-bold text-forest">{data.user.name}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          onNavigate();
          void signOutAndLeave();
        }}
        className={buttonClasses({ variant: "ghost", size: "sm" })}
      >
        Sign out
      </button>
    </div>
  );
}
