"use client";

import { useRef, useState, ViewTransition } from "react";
import Image from "next/image";
import type { ImageDTO } from "@nestama/shared";
import { cn } from "@/lib/cn";

/**
 * Product gallery: main image (shared-element morph from the product card), thumbnails,
 * ←/→ keys, and a gentle hover zoom that follows the pointer on mouse devices.
 */
export function Gallery({ images, slug, discountPercent }: { images: ImageDTO[]; slug: string; discountPercent: number }) {
  const [index, setIndex] = useState(0);
  const [origin, setOrigin] = useState("50% 50%");
  const [zoom, setZoom] = useState(false);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = images[index] ?? images[0]!;

  function select(i: number, focus = false) {
    const next = (i + images.length) % images.length;
    setIndex(next);
    if (focus) thumbs.current[next]?.focus();
  }

  return (
    <div className="lg:sticky lg:top-40" data-product-hero>
      <ViewTransition name={`product-${slug}`} share="morph" default="none">
        <div
          className="relative aspect-square overflow-hidden rounded-[2rem] bg-cream-deep ring-1 ring-line"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
          }}
          onPointerEnter={(e) => e.pointerType === "mouse" && setZoom(true)}
          onPointerLeave={() => setZoom(false)}
        >
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt}
            fill
            preload={index === 0}
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover transition-transform duration-300 ease-soft"
            style={{ transformOrigin: origin, transform: zoom ? "scale(1.6)" : "scale(1)" }}
          />
          {discountPercent > 0 && (
            <span className="absolute top-4 left-4 rounded-xl bg-ember px-3 py-1.5 text-sm font-extrabold tracking-wide text-white">
              {discountPercent}% OFF
            </span>
          )}
        </div>
      </ViewTransition>

      {images.length > 1 && (
        <div
          role="group"
          aria-label="Product images"
          className="mt-4 flex gap-3"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") select(index + 1, true);
            if (e.key === "ArrowLeft") select(index - 1, true);
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              onClick={() => select(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-pressed={i === index}
              className={cn(
                "relative size-20 overflow-hidden rounded-2xl ring-2 transition-[box-shadow,opacity] sm:size-24",
                i === index ? "ring-forest" : "opacity-75 ring-transparent hover:opacity-100",
              )}
            >
              <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
