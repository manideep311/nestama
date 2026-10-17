import { PAID_STATUSES, type AdminOverviewDTO, type Kpi, type ReportRange, type SalesReportDTO, type TopProductDTO } from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { bucketRevenue, percentChange } from "../../lib/reports";
import { toCsv } from "../../lib/csv";
import type { OrderStatus } from "../../generated/prisma/enums";
import { listInventory } from "./taxonomy.service";
import { adminOrderRowInclude, toAdminOrderRow } from "./orders.service";

const DAY_MS = 24 * 3600_000;
const PAID = PAID_STATUSES as OrderStatus[];

/** Paid (and not later cancelled) orders, dated by when they were paid. */
async function paidOrders(from: Date, to: Date) {
  return prisma.order.findMany({
    where: { status: { in: PAID }, paidAt: { gte: from, lt: to } },
    select: { id: true, total: true, paidAt: true },
  });
}

const kpi = (value: number, previous: number): Kpi => ({ value, previous, change: percentChange(value, previous) });

async function topProducts(orderIds: string[], limit: number): Promise<TopProductDTO[]> {
  if (orderIds.length === 0) return [];
  const groups = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { orderId: { in: orderIds }, productId: { not: null } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });
  const products = await prisma.product.findMany({
    where: { id: { in: groups.map((g) => g.productId!) } },
    select: { id: true, name: true, slug: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return groups
    .filter((g) => byId.has(g.productId!))
    .map((g) => {
      const p = byId.get(g.productId!)!;
      return {
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.images[0]?.url ?? null,
        quantity: g._sum.quantity ?? 0,
        revenue: g._sum.lineTotal ?? 0,
      };
    });
}

/** Dashboard: the last 30 days against the 30 before. */
export async function getOverview(now = new Date()): Promise<AdminOverviewDTO> {
  const from = new Date(now.getTime() - 30 * DAY_MS);
  const prevFrom = new Date(now.getTime() - 60 * DAY_MS);
  const [current, previous, newCustomers, prevCustomers, lowStock, recent] = await Promise.all([
    paidOrders(from, now),
    paidOrders(prevFrom, from),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: from, lt: now }, id: { not: { startsWith: "sample-reviewer-" } } } }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: prevFrom, lt: from }, id: { not: { startsWith: "sample-reviewer-" } } },
    }),
    listInventory({ low: true }),
    prisma.order.findMany({ include: adminOrderRowInclude, orderBy: { placedAt: "desc" }, take: 6 }),
  ]);
  const revenue = current.reduce((s, o) => s + o.total, 0);
  const prevRevenue = previous.reduce((s, o) => s + o.total, 0);
  const aov = current.length ? Math.round(revenue / current.length) : 0;
  const prevAov = previous.length ? Math.round(prevRevenue / previous.length) : 0;

  return {
    kpis: {
      revenue: kpi(revenue, prevRevenue),
      orders: kpi(current.length, previous.length),
      aov: kpi(aov, prevAov),
      customers: kpi(newCustomers, prevCustomers),
    },
    revenueByDay: bucketRevenue(
      current.map((o) => ({ placedAt: o.paidAt!, total: o.total })),
      { from: new Date(now.getTime() - 29 * DAY_MS), to: now, by: "day" },
    ),
    topProducts: await topProducts(
      current.map((o) => o.id),
      5,
    ),
    lowStock: lowStock.slice(0, 8),
    recentOrders: recent.map(toAdminOrderRow),
  };
}

const RANGE_DAYS: Record<ReportRange, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

export async function getSalesReport(range: ReportRange, now = new Date()): Promise<SalesReportDTO> {
  const days = RANGE_DAYS[range];
  const by = days > 30 ? "week" : "day";
  const from = new Date(now.getTime() - days * DAY_MS);
  const orders = await paidOrders(from, now);
  const orderIds = orders.map((o) => o.id);

  const items = orderIds.length
    ? await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          quantity: true,
          lineTotal: true,
          product: { select: { category: { select: { name: true, parent: { select: { name: true } } } } } },
        },
      })
    : [];
  const byCategory = new Map<string, { category: string; revenue: number; quantity: number }>();
  for (const item of items) {
    // Roll sub-categories up to their parent so the chart stays readable.
    const name = item.product?.category.parent?.name ?? item.product?.category.name ?? "Removed products";
    const row = byCategory.get(name) ?? { category: name, revenue: 0, quantity: 0 };
    row.revenue += item.lineTotal;
    row.quantity += item.quantity;
    byCategory.set(name, row);
  }

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  return {
    range,
    by,
    buckets: bucketRevenue(
      orders.map((o) => ({ placedAt: o.paidAt!, total: o.total })),
      { from: new Date(now.getTime() - (days - 1) * DAY_MS), to: now, by },
    ),
    byCategory: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue),
    topProducts: await topProducts(orderIds, 10),
    totals: { revenue, orders: orders.length, aov: orders.length ? Math.round(revenue / orders.length) : 0 },
  };
}

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const rupees = (paise: number) => (paise / 100).toFixed(2);

/** Every order (newest first, up to 5,000) as CSV for spreadsheets. Amounts in rupees. */
export async function ordersCsv(): Promise<string> {
  const orders = await prisma.order.findMany({
    orderBy: { placedAt: "desc" },
    take: 5000,
    include: {
      user: { select: { name: true, email: true } },
      items: { select: { quantity: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { method: true } },
    },
  });
  const rows = orders.map((o) => {
    const address = o.shippingAddress as { city?: string; state?: string; pincode?: string };
    return {
      number: o.number,
      placedAt: IST.format(o.placedAt),
      status: o.status,
      customer: o.user.name,
      email: o.user.email,
      items: o.items.reduce((n, i) => n + i.quantity, 0),
      subtotal: rupees(o.subtotal),
      discount: rupees(o.couponDiscount),
      coupon: o.couponCode ?? "",
      shipping: rupees(o.shipping),
      total: rupees(o.total),
      gst: rupees(o.gstIncluded),
      payment: o.payments[0]?.method ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      pincode: address.pincode ?? "",
    };
  });
  return toCsv(rows, [
    { key: "number", header: "Order" },
    { key: "placedAt", header: "Placed (IST)" },
    { key: "status", header: "Status" },
    { key: "customer", header: "Customer" },
    { key: "email", header: "Email" },
    { key: "items", header: "Items" },
    { key: "subtotal", header: "Subtotal (INR)" },
    { key: "discount", header: "Coupon discount (INR)" },
    { key: "coupon", header: "Coupon" },
    { key: "shipping", header: "Shipping (INR)" },
    { key: "total", header: "Total (INR)" },
    { key: "gst", header: "GST included (INR)" },
    { key: "payment", header: "Payment method" },
    { key: "city", header: "City" },
    { key: "state", header: "State" },
    { key: "pincode", header: "Pincode" },
  ]);
}
