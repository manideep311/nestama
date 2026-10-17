import { HeartHandshake, Headset, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { formatINR } from "@nestama/shared";

export function TrustSection({ freeShippingThreshold }: { freeShippingThreshold: number }) {
  const items = [
    { icon: Truck, title: "Free shipping", note: `On orders above ${formatINR(freeShippingThreshold)}` },
    { icon: ShieldCheck, title: "Secure payments", note: "UPI, cards and net banking" },
    { icon: RotateCcw, title: "Easy returns", note: "Hassle-free within 7 days" },
    { icon: Headset, title: "Customer support", note: "9am–9pm, every day" },
    { icon: PackageCheck, title: "Carefully selected", note: "Every product checked by us" },
    { icon: HeartHandshake, title: "Trusted by pet parents", note: "Honest reviews, real care" },
  ];

  return (
    <section aria-label="Why shop with NESTAMA" className="container-page pt-16 md:pt-24">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-3xl bg-white px-5 py-7 shadow-card ring-1 ring-line sm:grid-cols-3 lg:grid-cols-6 lg:px-8">
        {items.map(({ icon: Icon, title, note }) => (
          <li key={title} className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sage text-forest">
              <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-sm leading-snug">
              <strong className="block font-bold text-forest">{title}</strong>
              <span className="text-muted">{note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
