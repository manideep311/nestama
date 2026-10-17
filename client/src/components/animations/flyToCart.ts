// Add-to-cart flight: a copy of the product photo arcs to the header cart icon, leaving a short
// dotted paw trail. Pure DOM + Web Animations API, so it costs nothing until it runs.

const PAW_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="5.2" cy="10.2" rx="2.3" ry="2.9"/><ellipse cx="9.4" cy="5.6" rx="2.3" ry="3"/><ellipse cx="14.6" cy="5.6" rx="2.3" ry="3"/><ellipse cx="18.8" cy="10.2" rx="2.3" ry="2.9"/><path d="M12 11.2c-2.9 0-6.4 3.6-6.4 6.5 0 2 1.6 3 3.2 3 1.3 0 2.1-.7 3.2-.7s1.9.7 3.2.7c1.6 0 3.2-1 3.2-3 0-2.9-3.5-6.5-6.4-6.5Z"/></svg>';

const DURATION = 650;

function visibleCartTarget(): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  return (
    targets.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) ?? null
  );
}

/** Point on a quadratic curve that lifts above the straight line between the two rects. */
function arcPoint(t: number, dx: number, dy: number, lift: number) {
  const cx = dx * 0.5;
  const cy = dy * 0.5 - lift;
  const x = 2 * (1 - t) * t * cx + t * t * dx;
  const y = 2 * (1 - t) * t * cy + t * t * dy;
  return { x, y };
}

export function flyToCart(from: Element, imageSrc: string): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = visibleCartTarget();
  if (!target || !imageSrc) return;

  const f = from.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const size = Math.max(48, Math.min(f.width, f.height, 120));
  const startX = f.left + f.width / 2 - size / 2;
  const startY = f.top + f.height / 2 - size / 2;
  const dx = t.left + t.width / 2 - (startX + size / 2);
  const dy = t.top + t.height / 2 - (startY + size / 2);
  const lift = Math.min(160, Math.max(60, Math.abs(dy) * 0.35));

  const ghost = document.createElement("img");
  ghost.src = imageSrc;
  ghost.alt = "";
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "18px",
    zIndex: "95",
    pointerEvents: "none",
    boxShadow: "0 18px 40px -12px rgb(18 61 47 / 0.45)",
    // Resting state is invisible: if the flight ends while the tab is hidden, nothing lingers.
    opacity: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(ghost);
  // Animation events don't fire in background tabs, so clean up on a timer as well.
  const cleanup: Element[] = [ghost];
  window.setTimeout(() => cleanup.forEach((el) => el.remove()), DURATION + 900);

  const steps = 12;
  const frames: Keyframe[] = Array.from({ length: steps + 1 }, (_, i) => {
    const p = i / steps;
    const { x, y } = arcPoint(p, dx, dy, lift);
    return {
      offset: p,
      transform: `translate(${x}px, ${y}px) scale(${1 - 0.86 * p})`,
      opacity: p > 0.85 ? 0.5 : 1,
      borderRadius: p > 0.5 ? "50%" : "18px",
    };
  });
  const flight = ghost.animate(frames, { duration: DURATION, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });
  flight.onfinish = () => ghost.remove();
  flight.oncancel = () => ghost.remove();

  // Dotted paw trail along the arc.
  [0.25, 0.45, 0.65, 0.82].forEach((p, i) => {
    const { x, y } = arcPoint(p, dx, dy, lift);
    const paw = document.createElement("span");
    paw.innerHTML = PAW_SVG;
    Object.assign(paw.style, {
      position: "fixed",
      left: `${startX + size / 2 + x - 7}px`,
      top: `${startY + size / 2 + y - 7}px`,
      width: "14px",
      height: "14px",
      color: "#FF571F",
      zIndex: "94",
      pointerEvents: "none",
      opacity: "0",
      transform: `rotate(${-30 + i * 20}deg)`,
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(paw);
    cleanup.push(paw);
    const delay = DURATION * p * 0.9;
    const fade = paw.animate(
      [
        { opacity: 0, scale: "0.4" },
        { opacity: 0.9, scale: "1", offset: 0.25 },
        { opacity: 0, scale: "0.8" },
      ],
      { duration: 520, delay, easing: "ease-out", fill: "both" },
    );
    fade.onfinish = () => paw.remove();
    fade.oncancel = () => paw.remove();
  });
}
