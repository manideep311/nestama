"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, Loader2, MapPin, Package, Plus } from "lucide-react";
import { firstFieldErrors, profileUpdateSchema, type AddressDTO, type AddressInput } from "@nestama/shared";
import { authClient, authErrorMessage, useSession } from "@/lib/auth-client";
import { useAddresses, useDeleteAddress, useOrders, useProductsByIds, useSaveAddress } from "@/lib/account-client";
import { useWishlist } from "@/lib/wishlist-store";
import { useToast } from "@/components/toast/ToastProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormAlert, PasswordField, TextField } from "@/components/ui/Field";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { Modal, useModalTarget } from "@/components/ui/Modal";
import { ProductCard } from "@/components/product/ProductCard";
import { DogMascot } from "@/components/animations/DogMascot";
import { OrderCard, OrderCardSkeleton } from "./OrderCard";
import { AddressForm } from "./AddressForm";

export function PageHeading({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {children && <p className="mt-1.5 text-muted">{children}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-sage text-forest">{icon}</div>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <FormAlert className="flex flex-wrap items-center justify-between gap-3">
      We couldn&apos;t load this right now.
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </FormAlert>
  );
}

/* ───────── Overview ───────── */

export function AccountOverview() {
  const { data: session } = useSession();
  const orders = useOrders(1);
  const addresses = useAddresses();
  const { ids } = useWishlist();
  const first = session?.user.name.split(" ")[0];

  return (
    <div>
      <div className="mb-8 flex items-center gap-4 rounded-[2rem] bg-sage/70 p-6 sm:p-8">
        <DogMascot className="hidden size-20 shrink-0 sm:block" />
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{first ? `Hi, ${first}` : "Your account"}</h1>
          <p className="mt-1 text-forest/80">{session?.user.email}</p>
        </div>
      </div>

      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/account/orders", icon: Package, label: "Orders", value: orders.data ? String(orders.data.total) : "–" },
          {
            href: "/account/addresses",
            icon: MapPin,
            label: "Saved addresses",
            value: addresses.data ? String(addresses.data.length) : "–",
          },
          { href: "/account/wishlist", icon: Heart, label: "Wishlist", value: String(ids.length) },
        ].map(({ href, icon: Icon, label, value }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card ring-1 ring-line transition-shadow hover:shadow-lift"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-peach/70 text-orange-ink">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-extrabold text-charcoal tabular-nums">{value}</span>
              <span className="text-sm text-muted">{label}</span>
            </span>
          </Link>
        ))}
      </div>

      <section aria-labelledby="recent-orders">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-orders" className="text-2xl font-extrabold">
            Recent orders
          </h2>
          {orders.data && orders.data.total > 3 && (
            <Link href="/account/orders" className="text-sm font-bold text-orange-ink underline-offset-4 hover:underline">
              View all
            </Link>
          )}
        </div>
        {orders.isPending ? (
          <div className="space-y-3">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        ) : orders.isError ? (
          <ErrorState onRetry={() => void orders.refetch()} />
        ) : orders.data.items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" aria-hidden="true" />}
            title="No orders yet"
            action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
          >
            When you place an order, you can follow it here from packing to your doorstep.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {orders.data.items.slice(0, 3).map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── Orders ───────── */

export function AccountOrders() {
  const [page, setPage] = useState(1);
  const orders = useOrders(page);

  return (
    <div>
      <PageHeading title="Your orders">Every order you&apos;ve placed, newest first.</PageHeading>
      {orders.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" aria-hidden="true" />}
          title="No orders yet"
          action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
        >
          When you place an order, you can follow it here from packing to your doorstep.
        </EmptyState>
      ) : (
        <>
          <div className="space-y-3" aria-busy={orders.isPlaceholderData || undefined}>
            {orders.data.items.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
          {orders.data.totalPages > 1 && (
            <nav aria-label="Order pages" className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span className="text-sm text-muted">
                Page {page} of {orders.data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= orders.data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── Addresses ───────── */

function toAddressInput(a: AddressDTO): AddressInput {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state as AddressInput["state"],
    pincode: a.pincode,
    isDefault: a.isDefault,
  };
}

function AddressCard({ address, onEdit }: { address: AddressDTO; onEdit: () => void }) {
  const remove = useDeleteAddress();
  const save = useSaveAddress();
  const { show } = useToast();

  return (
    <article className="flex flex-col rounded-3xl bg-white p-5 shadow-card ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-extrabold text-charcoal">{address.fullName}</h2>
        {address.isDefault && <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-extrabold text-forest">Default</span>}
      </div>
      <address className="mt-2 text-sm leading-relaxed text-charcoal/85 not-italic">
        {address.line1}
        {address.line2 && <>, {address.line2}</>}
        <br />
        {address.landmark && (
          <>
            Near {address.landmark}
            <br />
          </>
        )}
        {address.city}, {address.state} {address.pincode}
        <br />
        <span className="text-muted">Mobile: {address.phone}</span>
      </address>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <InlineConfirm
          action="Delete"
          prompt="Delete this address?"
          cancelLabel="Keep it"
          pending={remove.isPending}
          onConfirm={() => {
            // A promise, not mutate() callbacks: those are skipped once this card unmounts.
            void remove.mutateAsync(address.id).then(
              () => show({ title: "Address deleted", icon: "check", duration: 2500 }),
              (err: Error) => show({ title: "Couldn't delete that address", description: err.message, icon: "alert" }),
            );
          }}
        >
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          {!address.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: address.id, data: { ...toAddressInput(address), isDefault: true } })}
            >
              Set as default
            </Button>
          )}
        </InlineConfirm>
      </div>
    </article>
  );
}

export function AccountAddresses() {
  const addresses = useAddresses();
  const { show } = useToast();
  const dialog = useModalTarget<AddressDTO | "new">();

  const addButton = (
    <Button onClick={() => dialog.show("new")}>
      <Plus className="size-5" aria-hidden="true" /> Add address
    </Button>
  );

  return (
    <div>
      <PageHeading title="Addresses" action={addresses.data && addresses.data.length > 0 ? addButton : undefined}>
        Where we deliver. Your default address is picked first at checkout.
      </PageHeading>

      {addresses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 skeleton rounded-3xl" />
          <div className="h-48 skeleton rounded-3xl" />
        </div>
      ) : addresses.isError ? (
        <ErrorState onRetry={() => void addresses.refetch()} />
      ) : addresses.data.length === 0 ? (
        <EmptyState icon={<MapPin className="size-6" aria-hidden="true" />} title="No saved addresses" action={addButton}>
          Add an address now and checkout will be one step shorter.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.data.map((a) => (
            <AddressCard key={a.id} address={a} onEdit={() => dialog.show(a)} />
          ))}
        </div>
      )}

      <Modal open={dialog.open} onClose={dialog.close} title={dialog.target === "new" ? "Add an address" : "Edit address"}>
        <AddressForm
          address={dialog.target && dialog.target !== "new" ? dialog.target : undefined}
          onSaved={() => {
            show({ title: dialog.target === "new" ? "Address saved" : "Address updated", icon: "check", duration: 2500 });
            dialog.close();
          }}
          onCancel={dialog.close}
        />
      </Modal>
    </div>
  );
}

/* ───────── Wishlist ───────── */

export function AccountWishlist() {
  const { data: session, isPending: sessionPending } = useSession();
  const { ids } = useWishlist();
  const products = useProductsByIds(ids);
  // Keep the saved order (newest first); skip anything no longer in the catalogue.
  const items = ids.map((id) => products.data?.find((p) => p.id === id)).filter((p) => p !== undefined);

  return (
    <div>
      <PageHeading title="Wishlist">
        {ids.length > 0 ? `${ids.length} saved ${ids.length === 1 ? "item" : "items"}` : "Things you’ve saved for later."}
      </PageHeading>

      {!sessionPending && !session && ids.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-peach/60 px-5 py-4">
          <p className="text-sm font-semibold text-orange-ink">Saved on this device only. Sign in to keep your wishlist everywhere.</p>
          <ButtonLink href="/login?next=/account/wishlist" size="sm" variant="forest">
            Sign in
          </ButtonLink>
        </div>
      )}

      {ids.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" aria-hidden="true" />}
          title="Nothing saved yet"
          action={<ButtonLink href="/shop">Browse products</ButtonLink>}
        >
          Tap the heart on anything you love and it will wait for you here.
        </EmptyState>
      ) : products.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {ids.slice(0, 6).map((id) => (
            <div key={id} className="aspect-[3/4] skeleton rounded-3xl" />
          ))}
        </div>
      ) : products.isError ? (
        <ErrorState onRetry={() => void products.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Profile ───────── */

function ProfileForm() {
  const { data: session, refetch } = useSession();
  const { show } = useToast();
  const [name, setName] = useState(session?.user.name ?? "");
  const [phone, setPhone] = useState(session?.user.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse({ name, phone });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.updateUser({ name: parsed.data.name, phone: parsed.data.phone ?? "" });
    setPending(false);
    if (error) setFormError(authErrorMessage(error));
    else {
      await refetch();
      show({ title: "Profile updated", icon: "check", duration: 2500 });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <FormAlert className="sm:col-span-2">{formError}</FormAlert>}
      <TextField
        label="Name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        maxLength={60}
      />
      <TextField
        label="Mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
        optional
        maxLength={16}
      />
      <TextField
        label="Email"
        type="email"
        value={session?.user.email ?? ""}
        disabled
        hint="Your sign-in email can't be changed here."
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { show } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = {
      current: current ? undefined : "Enter your current password.",
      next: next.length >= 8 ? (next === current ? "Choose a password you haven't used here." : undefined) : "Use at least 8 characters.",
    };
    setErrors(found);
    if (found.current || found.next) return;
    setFormError(null);
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) setFormError(authErrorMessage(error));
    else {
      setCurrent("");
      setNext("");
      show({ title: "Password changed", description: "Other devices have been signed out.", icon: "check" });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <FormAlert className="sm:col-span-2">{formError}</FormAlert>}
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errors.current}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.next}
        hint="At least 8 characters."
      />
      <div className="sm:col-span-2">
        <Button type="submit" variant="forest" disabled={pending} aria-busy={pending || undefined}>
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          Change password
        </Button>
      </div>
    </form>
  );
}

export function AccountProfile() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [leaving, setLeaving] = useState(false);

  return (
    <div>
      <PageHeading title="Profile">Your details and sign-in.</PageHeading>
      <div className="space-y-6">
        <section aria-labelledby="details-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-8">
          <h2 id="details-heading" className="mb-5 text-xl font-extrabold">
            Your details
          </h2>
          {isPending || !session ? <div className="h-40 skeleton rounded-2xl" /> : <ProfileForm key={session.user.id} />}
        </section>
        <section aria-labelledby="password-heading" className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-8">
          <h2 id="password-heading" className="mb-5 text-xl font-extrabold">
            Change password
          </h2>
          <PasswordForm />
        </section>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-sage/60 p-6 sm:p-8">
          <p className="text-forest">Signed in as {session?.user.email}</p>
          <Button
            variant="outline"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await authClient.signOut();
              router.replace("/");
            }}
          >
            Sign out <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </section>
      </div>
    </div>
  );
}
