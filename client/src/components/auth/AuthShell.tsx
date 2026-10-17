"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { Heart, MapPin, Truck } from "lucide-react";
import { PetTag, type TagText } from "./PetTag";

type Variant = "signin" | "register" | "recover";

const TAGS: Record<Variant, TagText> = {
  signin: { top: "NESTAMA", main: "Welcome back", bottom: "TO THE PACK" },
  register: { top: "NESTAMA", main: "Your name", bottom: "PACK MEMBER" },
  recover: { top: "NESTAMA", main: "Lost & found", bottom: "WE'LL GET YOU HOME" },
};

const TagNameContext = createContext<(name: string) => void>(() => {});

/** Lets the register form engrave the typed first name onto the tag. */
export function useEngraveName() {
  return use(TagNameContext);
}

/**
 * Two-panel auth layout: a forest brand panel with the collar tag (desktop) and the form card.
 * On phones the panel folds away and a smaller tag sits above the form.
 */
export function AuthShell({ variant, children }: { variant: Variant; children: ReactNode }) {
  const [name, setName] = useState("");
  const first = name.trim().split(/\s+/)[0] ?? "";
  const tag = variant === "register" && first ? { ...TAGS.register, main: first } : TAGS[variant];

  return (
    <TagNameContext value={setName}>
      <div className="container-page py-8 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden overflow-hidden rounded-[2rem] bg-forest p-10 text-cream lg:flex lg:flex-col">
            <PetTag text={tag} className="mx-auto w-52" />
            <p className="mt-8 text-center font-hand text-[1.7rem] leading-tight text-peach">
              {variant === "recover" ? "Every good dog finds its way home." : "One account for every whisker and wag."}
            </p>
            <ul className="mt-8 space-y-3.5 text-[15px] text-cream/85">
              <li className="flex items-center gap-3">
                <Truck className="size-5 shrink-0 text-orange" aria-hidden="true" /> Track every order from packed to doorstep
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="size-5 shrink-0 text-orange" aria-hidden="true" /> Save addresses for a quicker checkout
              </li>
              <li className="flex items-center gap-3">
                <Heart className="size-5 shrink-0 text-orange" aria-hidden="true" /> Keep your wishlist on every device
              </li>
            </ul>
          </aside>

          <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-line sm:p-10">
            <PetTag text={tag} className="mx-auto -mt-1 mb-4 w-24 lg:hidden" />
            {children}
          </section>
        </div>
      </div>
    </TagNameContext>
  );
}
