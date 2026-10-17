import { Gift, Megaphone, Sparkles, Truck } from "lucide-react";
import { formatINR, type PromotionDTO, type StoreSettingsPublicDTO } from "@nestama/shared";
import { DeliveryPincode } from "./DeliveryPincode";

interface Props {
  settings: StoreSettingsPublicDTO;
  offer: PromotionDTO | null;
}

/**
 * Forest strip above the header: the admin's announcement (if any), shipping threshold, live coupon,
 * offer and delivery location. Phones show only the first message.
 */
export function AnnouncementBar({ settings, offer }: Props) {
  const items = [
    settings.announcementText && { icon: Megaphone, text: settings.announcementText },
    { icon: Truck, text: <>Free shipping on orders above {formatINR(settings.freeShippingThreshold)}</> },
    offer?.coupon && {
      icon: Gift,
      text: (
        <>
          Use code <strong className="font-extrabold text-peach">{offer.coupon.code}</strong> for {offer.coupon.label}
        </>
      ),
    },
    offer && {
      icon: Sparkles,
      text: (
        <>
          {offer.name} — up to {offer.discountPercent}% off
        </>
      ),
    },
  ].filter(Boolean) as { icon: typeof Truck; text: React.ReactNode }[];

  return (
    <div className="on-dark bg-forest text-[13px] text-cream">
      <div className="container-page flex h-10 items-center justify-between gap-4">
        {/* Desktop: all messages inline. Mobile: the first message only, to keep the bar to one line. */}
        <ul className="flex min-w-0 items-center gap-6" aria-label="Store announcements">
          {items.map(({ icon: Icon, text }, i) => (
            <li key={i} className={i === 0 ? "flex min-w-0 items-center gap-2" : "hidden items-center gap-2 lg:flex"}>
              <Icon className="size-4 shrink-0 text-orange" aria-hidden="true" />
              <span className="truncate">{text}</span>
            </li>
          ))}
        </ul>
        <DeliveryPincode />
      </div>
    </div>
  );
}
