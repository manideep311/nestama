"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { PetMomentProvider } from "@/components/animations/PetMomentProvider";
import { QuickViewProvider } from "@/components/product/QuickView";
import { SessionSync } from "@/components/auth/SessionSync";

// Light `m.*` components plus only the features we use (`strict` makes a full `motion.*` component an
// error). Loaded up front on purpose: fetching them after hydration re-rendered every animated
// component a second time and more than doubled Total Blocking Time (median of 5 Lighthouse runs).

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <SessionSync />
        <ToastProvider>
          <PetMomentProvider>
            <QuickViewProvider>{children}</QuickViewProvider>
          </PetMomentProvider>
        </ToastProvider>
      </LazyMotion>
    </QueryClientProvider>
  );
}
