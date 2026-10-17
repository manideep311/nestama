"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddressDTO, AddressInput, OrderDetailDTO, OrderSummaryDTO, Paginated, ProductCardDTO } from "@nestama/shared";
import { apiFetch } from "./cart-client";

// Signed-in data. Every key starts with "account" so signing out (SessionSync) can drop it all.
export const accountKeys = {
  addresses: ["account", "addresses"] as const,
  orders: (page: number) => ["account", "orders", page] as const,
  order: (id: string) => ["account", "order", id] as const,
};

export function useAddresses(enabled = true) {
  return useQuery({ queryKey: accountKeys.addresses, queryFn: () => apiFetch<AddressDTO[]>("/account/addresses"), enabled });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: AddressInput }) =>
      apiFetch<AddressDTO>(id ? `/account/addresses/${id}` : "/account/addresses", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<AddressDTO[]>(`/account/addresses/${id}`, { method: "DELETE" }),
    onSuccess: (list) => qc.setQueryData(accountKeys.addresses, list),
  });
}

export function useOrders(page: number) {
  return useQuery({
    queryKey: accountKeys.orders(page),
    queryFn: () => apiFetch<Paginated<OrderSummaryDTO>>(`/account/orders?page=${page}`),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: accountKeys.order(id),
    queryFn: () => apiFetch<OrderDetailDTO>(`/orders/${encodeURIComponent(id)}`),
    retry: (count, err) => count < 1 && !(err instanceof Error && "status" in err && (err as { status: number }).status === 404),
  });
}

export function useProductsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["products", "by-ids", ids],
    queryFn: () => apiFetch<ProductCardDTO[]>(`/products/by-ids?ids=${ids.join(",")}`),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
}
