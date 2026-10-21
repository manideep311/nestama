"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, CreditCard, Landmark, Loader2, Lock, Smartphone, X } from "lucide-react";
import { formatINR, type OrderDetailDTO, type PaymentMethodValue } from "@nestama/shared";
import { usePayment, type PayableOrder } from "@/lib/checkout-client";
import { ApiRequestError } from "@/lib/cart-client";
import { cardBrand, expiryValid, formatCardNumber, formatExpiry, luhnValid, upiValid } from "@/lib/payment-format";
import { Button } from "@/components/ui/Button";
import { FormAlert, SelectField, TextField } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const METHODS: { id: PaymentMethodValue; label: string; icon: typeof Smartphone }[] = [
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "CARD", label: "Card", icon: CreditCard },
  { id: "NETBANKING", label: "Netbanking", icon: Landmark },
];

// Fictional banks: this is a demo gateway, so it never shows real banks' names.
const DEMO_BANKS = ["Pawsome Bank", "Whisker Co-operative Bank", "Kibble Trust Bank", "Tailwag Savings Bank"];

type Stage = { kind: "form" } | { kind: "processing" } | { kind: "failed"; reason: string };

/**
 * NestaPay — a clearly labelled demo payment window that mirrors a real gateway's flow. Inputs are
 * only format-checked here; the server receives the chosen method and outcome, nothing typed.
 */
export function NestaPayDialog({
  order,
  onClose,
  onPaid,
  onRetry,
}: {
  order: PayableOrder | null;
  onClose: () => void;
  onPaid: (order: OrderDetailDTO) => void;
  /** Start a fresh attempt after a declined payment (a declined order can't be paid again). */
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const pay = usePayment();
  const open = order !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Each new order starts at the form.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (order && order.gatewayOrderId !== shownFor) {
    setShownFor(order.gatewayOrderId);
    setStage({ kind: "form" });
  }

  async function submit(method: PaymentMethodValue, simulateFailure: boolean) {
    if (!order) return;
    setStage({ kind: "processing" });
    const started = Date.now();
    try {
      const result = await pay.mutateAsync({ order, method, outcome: simulateFailure ? "failure" : "success" });
      // A beat of "contacting your bank" so the hand-off reads like a real gateway.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      if (result.ok) onPaid(result.order);
      else setStage({ kind: "failed", reason: result.reason });
    } catch (err) {
      setStage({
        kind: "failed",
        reason: err instanceof ApiRequestError ? err.message : "We couldn't reach NestaPay. Check your connection and try again.",
      });
    }
  }

  const busy = stage.kind === "processing";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (busy) e.preventDefault(); // don't abandon a payment mid-flight
      }}
      onClose={onClose}
      className="quick-view dialog-narrow bg-white text-charcoal shadow-lift"
    >
      <div className="flex items-center justify-between gap-3 bg-forest px-5 py-4 text-cream sm:px-7">
        <p id={titleId} className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Lock className="size-4" aria-hidden="true" /> NestaPay
          <span className="rounded-full bg-cream/15 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] uppercase">Demo</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close payment window"
          className="grid size-9 place-items-center rounded-full text-cream/90 hover:bg-cream/10 disabled:opacity-40"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {order && (
        <div className="p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-sm text-muted">Paying NESTAMA</p>
              <p className="text-sm font-semibold text-charcoal">Order {order.orderNumber}</p>
            </div>
            <p className="text-3xl font-extrabold text-charcoal tabular-nums">{formatINR(order.amount)}</p>
          </div>

          {stage.kind === "processing" ? (
            <div role="status" className="flex flex-col items-center gap-3 py-14 text-center">
              <Loader2 className="size-10 animate-spin text-forest" aria-hidden="true" />
              <p className="font-bold text-forest">Confirming with your bank…</p>
            </div>
          ) : stage.kind === "failed" ? (
            <div role="alert" className="py-8 text-center">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-peach text-orange-ink">
                <AlertTriangle className="size-7" aria-hidden="true" />
              </span>
              <p className="text-xl font-extrabold">Payment failed</p>
              <p className="mx-auto mt-2 max-w-sm text-muted">{stage.reason}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Nothing was charged and your items are still in your cart.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={onRetry}>Try again</Button>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <PaymentForm amount={order.amount} onSubmit={submit} />
          )}
        </div>
      )}
    </dialog>
  );
}

function PaymentForm({ amount, onSubmit }: { amount: number; onSubmit: (method: PaymentMethodValue, simulateFailure: boolean) => void }) {
  const [method, setMethod] = useState<PaymentMethodValue>("UPI");
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [upi, setUpi] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [bank, setBank] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function validate(): Record<string, string | undefined> {
    if (method === "UPI") return { upi: upiValid(upi) ? undefined : "Enter a UPI ID like name@bank." };
    if (method === "CARD") {
      return {
        number: luhnValid(card.number) ? undefined : "That card number isn't valid. Try the test card below.",
        expiry: expiryValid(card.expiry) ? undefined : "Enter a future expiry as MM/YY.",
        cvv: /^\d{3,4}$/.test(card.cvv) ? undefined : "Enter the 3 or 4 digit CVV.",
        name: card.name.trim().length >= 2 ? undefined : "Enter the name on the card.",
      };
    }
    return { bank: bank ? undefined : "Choose your bank." };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onSubmit(method, simulateFailure);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = METHODS.length - 1;
    const next =
      e.key === "ArrowRight"
        ? (index + 1) % METHODS.length
        : e.key === "ArrowLeft"
          ? (index + last) % METHODS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    setMethod(METHODS[next]!.id);
    setErrors({});
    tabRefs.current[next]?.focus();
  }

  const brand = cardBrand(card.number);

  return (
    <form onSubmit={handleSubmit} noValidate className="pt-5">
      <div role="tablist" aria-label="Payment method" className="grid grid-cols-3 gap-2">
        {METHODS.map(({ id, label, icon: Icon }, i) => {
          const selected = method === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setMethod(id);
                setErrors({});
              }}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-bold transition-colors",
                selected ? "border-forest bg-forest text-cream" : "border-line bg-white text-forest hover:border-forest/40",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${method}`} className="mt-5 grid gap-4">
        {method === "UPI" && (
          <TextField
            label="UPI ID"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="yourname@bank"
            autoComplete="off"
            spellCheck={false}
            error={errors.upi}
            hint={<TestValue>Test ID: success@nestapay</TestValue>}
          />
        )}

        {method === "CARD" && (
          <>
            <TextField
              label={brand ? `Card number · ${brand}` : "Card number"}
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234 5678 9012 3456"
              error={errors.number}
              hint={<TestValue>Test card: 4111 1111 1111 1111</TestValue>}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Expiry (MM/YY)"
                value={card.expiry}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Deleting the slash shouldn't snap it straight back.
                  const deleting = raw.length < card.expiry.length;
                  setCard((c) => ({ ...c, expiry: deleting ? raw : formatExpiry(raw) }));
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/YY"
                maxLength={5}
                error={errors.expiry}
              />
              <TextField
                label="CVV"
                value={card.cvv}
                onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="123"
                error={errors.cvv}
              />
            </div>
            <TextField
              label="Name on card"
              value={card.name}
              onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
              autoComplete="off"
              error={errors.name}
            />
          </>
        )}

        {method === "NETBANKING" && (
          <SelectField label="Your bank" value={bank} onChange={(e) => setBank(e.target.value)} error={errors.bank}>
            <option value="" disabled>
              Choose a bank
            </option>
            {DEMO_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </SelectField>
        )}
      </div>

      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={simulateFailure}
          onChange={(e) => setSimulateFailure(e.target.checked)}
          className="size-5 rounded-md accent-ember"
        />
        <span>
          <span className="font-bold text-charcoal">Simulate a failed payment</span>
          <span className="block text-muted">See what happens when a bank declines.</span>
        </span>
      </label>

      {Object.values(errors).some(Boolean) && <FormAlert className="mt-4">Check the highlighted details.</FormAlert>}

      <Button type="submit" size="lg" className="mt-5 w-full">
        <Lock className="size-4" aria-hidden="true" /> Pay {formatINR(amount)}
      </Button>
    </form>
  );
}

function TestValue({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-forest">{children}</span>;
}
