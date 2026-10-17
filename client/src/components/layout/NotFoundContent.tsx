import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { DogMascot } from "@/components/animations/DogMascot";

export function NotFoundContent() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <DogMascot className="mx-auto size-36" />
        <p className="mt-4 text-xs font-bold tracking-[0.2em] text-orange-ink uppercase">Error 404</p>
        <h1 className="mt-2 text-4xl font-extrabold">We sniffed everywhere</h1>
        <p className="mt-3 text-muted">
          This page wandered off. It may have moved, or the link might be mistyped. Let&apos;s get you back to the good stuff.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">
            Back to home <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/offers" variant="outline">
            See today&apos;s offers
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
