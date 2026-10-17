import type { ReactNode } from "react";
import type { PromotionDTO, StoreSettingsPublicDTO } from "@nestama/shared";
import { getActivePromotions, getStoreSettings } from "@/lib/catalog";
import { AnnouncementBar } from "./AnnouncementBar";
import { DemoRibbon } from "./DemoRibbon";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { InitialLoadingScreen } from "@/components/loader/InitialLoadingScreen";

/** Fallback copy if the API can't be reached, so the shell still renders. */
const fallbackSettings: StoreSettingsPublicDTO = {
  announcementText: "",
  freeShippingThreshold: 99900,
  flatShippingFee: 7900,
  gstRatePercent: 18,
  heroHeadline: "Happy Pets. Happier Lives.",
  heroSubcopy: "Thoughtfully chosen essentials for the ones who make your life better.",
  heroImage: { url: "", alt: "" },
  popularSearches: [],
  supportEmail: "hello@nestama.test",
  supportPhone: "1800-NESTAMA",
};

async function loadChrome(): Promise<{ settings: StoreSettingsPublicDTO; offer: PromotionDTO | null }> {
  try {
    const [settings, promotions] = await Promise.all([getStoreSettings(), getActivePromotions()]);
    return { settings, offer: promotions.find((p) => p.placement === "COUNTDOWN_BANNER") ?? null };
  } catch (err) {
    console.error("[layout] Store chrome unavailable:", err);
    return { settings: fallbackSettings, offer: null };
  }
}

/** The storefront's frame: intro film, demo ribbon, announcement bar, header and footer. */
export async function StoreFrame({ children }: { children: ReactNode }) {
  const { settings, offer } = await loadChrome();
  return (
    <>
      <InitialLoadingScreen />
      {/* The intro player marks this inert while the film plays (hence suppressHydrationWarning). */}
      <div id="site" className="flex flex-1 flex-col" suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <DemoRibbon />
        <AnnouncementBar settings={settings} offer={offer} />
        <Header popularSearches={settings.popularSearches} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer settings={settings} />
      </div>
    </>
  );
}
