import {
  MAX_ADDRESSES,
  type AddressData,
  type AddressDTO,
  type OrderDetailDTO,
  type OrderSummaryDTO,
  type Paginated,
} from "@nestama/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import type { Prisma } from "../../generated/prisma/client";
import { expireIfStale } from "../orders/order-expiry";
import { orderDetailInclude, orderSummaryInclude, toOrderDetailDTO, toOrderSummaryDTO } from "../orders/orders.mapper";

type AddressRow = Prisma.AddressGetPayload<object>;

export function toAddressDTO(a: AddressRow): AddressDTO {
  return {
    id: a.id,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    isDefault: a.isDefault,
  };
}

const addressOrder = [{ isDefault: "desc" }, { updatedAt: "desc" }] satisfies Prisma.AddressOrderByWithRelationInput[];

export async function listAddresses(userId: string): Promise<AddressDTO[]> {
  const rows = await prisma.address.findMany({ where: { userId }, orderBy: addressOrder });
  return rows.map(toAddressDTO);
}

async function ownedAddress(userId: string, id: string): Promise<AddressRow> {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw new AppError("ADDRESS_NOT_FOUND", 404, "That address doesn't exist.");
  return address;
}

function addressFields(data: AddressData) {
  return {
    fullName: data.fullName,
    phone: data.phone,
    line1: data.line1,
    line2: data.line2 ?? null,
    landmark: data.landmark ?? null,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
  };
}

/** The first address becomes the default; choosing a default clears the previous one. */
export async function createAddress(userId: string, data: AddressData): Promise<AddressDTO> {
  const count = await prisma.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) throw new AppError("ADDRESS_LIMIT", 409, `You can save up to ${MAX_ADDRESSES} addresses.`);
  const isDefault = data.isDefault || count === 0;
  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { userId, ...addressFields(data), isDefault } });
  });
  return toAddressDTO(created);
}

/** Full replace. The default can't be switched off directly — choosing another default moves it. */
export async function updateAddress(userId: string, id: string, data: AddressData): Promise<AddressDTO> {
  const existing = await ownedAddress(userId, id);
  const isDefault = data.isDefault || existing.isDefault;
  const updated = await prisma.$transaction(async (tx) => {
    if (isDefault && !existing.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: { ...addressFields(data), isDefault } });
  });
  return toAddressDTO(updated);
}

/** Deleting the default promotes the most recently used remaining address. */
export async function deleteAddress(userId: string, id: string): Promise<AddressDTO[]> {
  const existing = await ownedAddress(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  return listAddresses(userId);
}

const ORDERS_PAGE_SIZE = 10;

export async function listOrders(userId: string, page: number): Promise<Paginated<OrderSummaryDTO>> {
  const where = { userId } satisfies Prisma.OrderWhereInput;
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      include: orderSummaryInclude,
    }),
  ]);
  return {
    items: rows.map(toOrderSummaryDTO),
    page,
    pageSize: ORDERS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

/** One of the caller's orders (anyone else's reads as not found). Applies the lazy expiry check. */
export async function getOrder(userId: string, id: string): Promise<OrderDetailDTO> {
  const find = () => prisma.order.findFirst({ where: { id, userId }, include: orderDetailInclude });
  let order = await find();
  if (!order) throw new AppError("ORDER_NOT_FOUND", 404, "We couldn't find that order.");
  if (await expireIfStale(order)) order = (await find())!;
  return toOrderDetailDTO(order);
}
