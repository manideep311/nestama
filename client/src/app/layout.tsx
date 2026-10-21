import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Manrope } from "next/font/google";
import { InlineScript } from "@/components/ui/InlineScript";
import { introPreference } from "@/components/loader/InitialLoadingScreen";
import { SITE_URL } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";
import "@/components/animations/animations.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

// Handwritten asides only ("Different species, same love"), used sparingly.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  // Variable font: a single file covers every weight we use.
  display: "swap",
  // 75 KB and only used for small decorative asides, so it isn't worth a preload on every page's
  // critical path; it loads when an aside first renders.
  preload: false,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NESTAMA — Your True Friend", template: "%s · NESTAMA" },
  description:
    "Premium dog and cat essentials — food, toys, beds, grooming, travel and more, thoughtfully chosen for the ones who make your life better.",
  applicationName: "NESTAMA",
  // Resolves relative Open Graph and canonical URLs against the public origin.
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: "NESTAMA", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#123D2F",
};

// The storefront frame lives in (store)/layout.tsx; /admin has its own shell.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${bricolage.variable} ${manrope.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <InlineScript html={introPreference} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
