"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatINR, isPaid, type AdminCustomerDetailDTO, type AdminCustomerRowDTO, type Paginated } from "@nestama/shared";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin-client";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/auth-client";
import { useToast } from "@/components/toast/ToastProvider";
import { cn } from "@/lib/cn";
import { AdminPage, Badge, btn, ConfirmButton, DataTable, inputCls, LoadError, Pager, Panel, useDebounced } from "./AdminUI";
import { orderColumns } from "./Dashboard";

const RoleBadge = ({ role }: { role: "CUSTOMER" | "ADMIN" }) =>
  role === "ADMIN" ? <Badge tone="forest">Admin</Badge> : <Badge>Customer</Badge>;

export function CustomerList() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const list = useAdminQuery<Paginated<AdminCustomerRowDTO>>(["customers"], "/customers", { q: search, role, page });

  return (
    <AdminPage title="Customers" description="Everyone with an account. Spend counts paid orders only.">
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Name or email"
              className={cn(inputCls, "pl-9")}
            />
          </label>
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={cn(inputCls, "w-auto")}
          >
            <option value="">Everyone</option>
            <option value="CUSTOMER">Customers</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            <DataTable
              caption="Customers"
              rows={list.data?.items}
              rowKey={(c) => c.id}
              loading={list.isPending}
              dim={list.isPlaceholderData}
              empty={search || role ? "No one matches these filters." : "No customers yet."}
              columns={[
                {
                  key: "name",
                  header: "Customer",
                  cell: (c) => (
                    <span className="block max-w-[18rem]">
                      <Link href={`/admin/customers/${c.id}`} className="block truncate font-bold text-charcoal hover:underline">
                        {c.name}
                      </Link>
                      <span className="block truncate text-xs text-muted">{c.email}</span>
                    </span>
                  ),
                },
                {
                  key: "joined",
                  header: "Joined",
                  cell: (c) => <span className="whitespace-nowrap text-muted">{formatDate(c.createdAt)}</span>,
                },
                { key: "orders", header: "Paid orders", align: "right", cell: (c) => c.orderCount },
                {
                  key: "spent",
                  header: "Spent",
                  align: "right",
                  cell: (c) => <span className="font-bold">{formatINR(c.totalSpent)}</span>,
                },
                { key: "role", header: "Role", cell: (c) => <RoleBadge role={c.role} /> },
              ]}
            />
            {list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </AdminPage>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const { show } = useToast();
  const { data: session } = useSession();
  const customer = useAdminQuery<AdminCustomerDetailDTO>(["customer", id], `/customers/${id}`);
  const setRole = useAdminMutation<"CUSTOMER" | "ADMIN", AdminCustomerDetailDTO>(
    (role) => ({ path: `/customers/${id}/role`, method: "PATCH", body: { role } }),
    [["customer"], ["customers"]],
  );

  if (customer.isError) {
    return (
      <AdminPage title="Customer">
        <LoadError error={customer.error} onRetry={() => void customer.refetch()} />
      </AdminPage>
    );
  }
  const c = customer.data;
  if (!c) return <div className="h-[28rem] skeleton rounded-2xl" aria-busy="true" />;
  const isSelf = session?.user.id === c.id;
  const next = c.role === "ADMIN" ? "CUSTOMER" : "ADMIN";

  return (
    <AdminPage
      title={c.name}
      description={c.email}
      actions={
        <Link href="/admin/customers" className={btn.ghost}>
          All customers
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Paid orders", c.orders.filter((o) => isPaid(o.status)).length.toLocaleString("en-IN")],
          ["Total spent", formatINR(c.totalSpent)],
          ["Reviews", c.reviewCount.toLocaleString("en-IN")],
          ["Saved addresses", c.addressCount.toLocaleString("en-IN")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-1.5 text-2xl font-extrabold text-charcoal">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel title="Orders">
          <DataTable
            caption={`Orders by ${c.name}`}
            columns={orderColumns.filter((col) => col.key !== "customer")}
            rows={c.orders}
            rowKey={(o) => o.id}
            empty="No orders yet."
          />
        </Panel>
        <aside className="space-y-6">
          <Panel title="Account">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Joined</dt>
                <dd className="font-semibold">{formatDate(c.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Phone</dt>
                <dd className="font-semibold">{c.phone ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">Role</dt>
                <dd>
                  <RoleBadge role={c.role} />
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Admin access">
            {isSelf ? (
              <p className="text-sm text-muted">This is you. Another admin has to change your role, so the store always keeps one.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">
                  {c.role === "ADMIN"
                    ? "They lose access to the admin straight away."
                    : "Admins can change products, prices, orders and other admins."}
                </p>
                <ConfirmButton
                  label={c.role === "ADMIN" ? "Remove admin access" : "Make admin"}
                  confirmLabel={c.role === "ADMIN" ? "Yes, remove access" : "Yes, make admin"}
                  pending={setRole.isPending}
                  onConfirm={() =>
                    setRole.mutate(next, {
                      onSuccess: (u) =>
                        show({
                          title: u.role === "ADMIN" ? "Now an admin" : "Admin access removed",
                          description: u.name,
                          icon: "check",
                          duration: 2500,
                        }),
                      onError: (e) => show({ title: "Couldn't change the role", description: errorMessage(e), icon: "alert" }),
                    })
                  }
                />
              </>
            )}
          </Panel>
        </aside>
      </div>
    </AdminPage>
  );
}
