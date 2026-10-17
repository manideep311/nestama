import { PawIcon } from "@/components/ui/icons";

/** Placeholder grid shaped exactly like the real one (no layout shift), with a gentle paw pulse. */
export function ListingSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[15.5rem_1fr]" aria-busy="true" aria-label="Loading products">
      <div className="hidden space-y-6 lg:block">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-4 w-24 skeleton rounded" />
            <div className="h-3.5 w-40 skeleton rounded" />
            <div className="h-3.5 w-32 skeleton rounded" />
          </div>
        ))}
      </div>
      <div>
        <div className="mb-6 h-5 w-48 skeleton rounded" />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className="rounded-3xl border border-line bg-white p-2.5">
              <div className="relative grid aspect-square skeleton place-items-center rounded-2xl">
                <PawIcon
                  className="size-8 animate-[paw-pulse_1.2s_ease-in-out_infinite] text-forest/15"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              </div>
              <div className="space-y-2 px-1.5 pt-3 pb-1">
                <div className="h-3 w-16 skeleton rounded" />
                <div className="h-4 w-full skeleton rounded" />
                <div className="h-4 w-3/4 skeleton rounded" />
                <div className="mt-3 flex items-end justify-between">
                  <div className="h-5 w-20 skeleton rounded" />
                  <div className="size-11 skeleton rounded-2xl" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
