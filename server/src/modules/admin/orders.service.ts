import {
  isPaid,
  ORDER_STATUS_LABEL,
  type AdminOrderDetailDTO,
  type AdminOrderRowDTO,
  type OrderStatusValue,
  type Paginated,
} from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { canTransition, nextFulfilmentStatus } from "../../lib/order-status";
import { revalidateStorefront } from "../../lib/revalidate";
import type { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import { closeUnpaidOrder, expireIfStale } from "../orders/order-expiry";
import { orderDetailInclude, toOrderDetailDTO } from "../orders/orders.mapper";

const PAGE_SIZE = 20;

export const adminOrderRowInclude = {
  user: { select: { id: true, name: true, email: true } },
  items: { select: { quantity: true } },
} satisfies Prisma.OrderInclude;

export function toAdminOrderRow(o: Prisma.OrderGetPayload<{ include: typeof adminOrderRowInclude }>): AdminOrderRowDTO {
  return {
    id: o.id,
    number: o.number,
    status: o.status as OrderStatusValue,
    placedAt: o.placedAt.toISOString(),
    total: o.total,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    customer: { id: o.user.id, name: o.user.name, email: o.user.email },
  };
}

export async function listAdminOrders(query: {
  status?: OrderStatusValue;
  q?: string;
  page: number;
}): Promise<Paginated<AdminOrderRowDTO>> {
  const where: Prisma.OrderWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.q && {
      OR: [
        { number: { contains: query.q, mode: "insensitive" } },
        { user: { email: { contains: query.q, mode: "insensitive" } } },
        { user: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: adminOrderRowInclude,
      orderBy: { placedAt: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(toAdminOrderRow),
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** What an admin may do next: move one fulfilment step on, or cancel before shipping. */
function adminActions(status: OrderStatusValue) {
  return {
    nextStatus: isPaid(status) ? nextFulfilmentStatus(status) : null,
    canCancel: canTransition(status, "CANCELLED"),
  };
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetailDTO> {
  const find = () =>
    prisma.order.findUnique({
      where: { id },
      include: { ...orderDetailInclude, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
  let order = await find();
  if (!order) throw new AppError("ORDER_NOT_FOUND", 404, "That order doesn't exist.");
  if (await expireIfStale(order)) order = (await find())!;
  const detail = toOrderDetailDTO(order);
  return { ...detail, customer: order.user, ...adminActions(detail.status) };
}

const DEFAULT_NOTE: Partial<Record<OrderStatusValue, string>> = {
  PACKED: "Packed and ready for pickup",
  SHIPPED: "Handed to our delivery partner",
  OUT_FOR_DELIVERY: "Out for delivery today",
  DELIVERED: "Delivered — enjoy!",
};

/**
 * Moves an order along: the next fulfilment step, or a cancellation. Cancelling an unpaid order
 * releases its reservation; cancelling a paid, unshipped order also returns stock, reverses sold
 * counts and frees the coupon (the demo refund is noted on the timeline).
 */
export async function updateOrderStatus(id: string, to: OrderStatusValue, note?: string): Promise<AdminOrderDetailDTO> {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, couponRedemption: true } });
  if (!order) throw new AppError("ORDER_NOT_FOUND", 404, "That order doesn't exist.");
  await expireIfStale(order);
  const from = (await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } })).status as OrderStatusValue;
  const allowed = adminActions(from);

  if (to === "CANCELLED") {
    if (!allowed.canCancel)
      throw new AppError("INVALID_TRANSITION", 409, `A ${ORDER_STATUS_LABEL[from].toLowerCase()} order can't be cancelled.`);
    if (from === "PENDING_PAYMENT") {
      await prisma.$transaction((tx) => closeUnpaidOrder(tx, id, "CANCELLED", note ?? "Cancelled by NESTAMA before payment"));
    } else {
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({ where: { id, status: from as OrderStatus }, data: { status: "CANCELLED" } });
        if (count === 0) throw new AppError("ORDER_CHANGED", 409, "This order was just updated. Refresh and try again.");
        const sold = new Map<string, number>();
        for (const item of order.items) {
          if (item.variantId)
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
          if (item.productId) sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity);
        }
        for (const [productId, quantity] of sold)
          await tx.product.update({ where: { id: productId }, data: { soldCount: { decrement: quantity } } });
        if (order.couponRedemption) {
          await tx.couponRedemption.delete({ where: { id: order.couponRedemption.id } });
          await tx.coupon.update({ where: { id: order.couponRedemption.couponId }, data: { usedCount: { decrement: 1 } } });
        }
        await tx.orderEvent.create({
          data: { orderId: id, status: "CANCELLED", note: note ?? "Cancelled by NESTAMA — refund initiated (demo)" },
        });
      });
    }
    revalidateStorefront();
    return getAdminOrder(id);
  }

  if (to !== allowed.nextStatus) {
    throw new AppError(
      "INVALID_TRANSITION",
      409,
      allowed.nextStatus
        ? `This order can move to “${ORDER_STATUS_LABEL[allowed.nextStatus]}” next, not “${ORDER_STATUS_LABEL[to]}”.`
        : `A ${ORDER_STATUS_LABEL[from].toLowerCase()} order can't move to “${ORDER_STATUS_LABEL[to]}”.`,
    );
  }
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id, status: from as OrderStatus }, data: { status: to } });
    if (count === 0) throw new AppError("ORDER_CHANGED", 409, "This order was just updated. Refresh and try again.");
    await tx.orderEvent.create({ data: { orderId: id, status: to, note: note ?? DEFAULT_NOTE[to] ?? null } });
  });
  return getAdminOrder(id);
}
