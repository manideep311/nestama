import Image from "next/image";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { StoreSettingsPublicDTO } from "@nestama/shared";
import { Logo } from "@/components/ui/Logo";
import { PawIcon } from "@/components/ui/icons";
import { footerNav } from "@/lib/nav";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcon, type SocialName } from "./SocialIcons";

const socials: { name: SocialName; label: string; href: string }[] = [
  { name: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
  { name: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
  { name: "youtube", label: "YouTube", href: "https://www.youtube.com/" },
  { name: "x", label: "X", href: "https://x.com/" },
];

const payments = ["UPI", "Visa", "Mastercard", "RuPay", "Net Banking"];

export function Footer({ settings }: { settings: StoreSettingsPublicDTO }) {
  return (
    <footer className="on-dark relative mt-24 overflow-hidden bg-forest text-cream">
      {/* Community band */}
      <div className="relative border-b border-white/10">
        <div className="container-page grid items-center gap-8 py-12 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-orange-soft uppercase">
              <PawIcon className="size-4" /> The NESTAMA pack
            </p>
            <h2 className="text-3xl font-extrabold text-cream sm:text-4xl">Join our pet-loving community</h2>
            <p className="mt-2 mb-5 max-w-md text-cream/80">
              Pet care tips, new arrivals and members-first offers. One friendly email a week, never spam.
            </p>
            <NewsletterForm />
          </div>
          <div className="relative hidden h-64 md:block">
            <div className="absolute inset-y-0 right-0 w-[min(28rem,100%)] overflow-hidden rounded-[2.5rem_2.5rem_2.5rem_8rem]">
              <Image
                src="https://images.unsplash.com/photo-1623387641168-d9803ddd3f35"
                alt="A dog and a cat relaxing together on the grass"
                fill
                sizes="(min-width: 768px) 28rem, 0px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-sm text-cream/75">
            Thoughtfully chosen essentials for dogs and cats — and the people who love them.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li>
              <a href={`mailto:${settings.supportEmail}`} className="inline-flex items-center gap-2 hover:text-orange">
                <Mail className="size-4 text-orange" aria-hidden="true" /> {settings.supportEmail}
              </a>
            </li>
            <li className="inline-flex items-center gap-2">
              <Phone className="size-4 text-orange" aria-hidden="true" /> {settings.supportPhone} · 9am–9pm, every day
            </li>
          </ul>
          <ul className="mt-5 flex gap-2" aria-label="NESTAMA on social media">
            {socials.map((s) => (
              <li key={s.name}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-orange hover:text-forest-900"
                >
                  <SocialIcon name={s.name} className="size-[18px]" />
                  <span className="sr-only">{s.label} (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <FooterColumn title="Shop" links={footerNav.shop} />
        <FooterColumn title="Customer service" links={footerNav.help} />
        <FooterColumn title="About NESTAMA" links={footerNav.company} />
      </div>

      {/* Payments + legal */}
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-cream/70 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-wrap gap-2" aria-label="Payment methods we accept">
            {payments.map((p) => (
              <li key={p} className="rounded-md bg-white/10 px-2.5 py-1 font-bold tracking-wide text-cream">
                {p}
              </li>
            ))}
          </ul>
          <p>© 2026 NESTAMA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-extrabold tracking-wide text-cream uppercase">{title}</h3>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-cream/80 transition-colors hover:text-orange">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
