"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddCartItemInput, ApiErrorBody, CartDTO } from "@nestama/shared";

// Client cart state. The server owns every number; the client only mirrors the latest CartDTO
// (and optimistically bumps the item count so the header reacts instantly).

export const cartKey = ["cart"] as const;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      res.status,
      body?.error.code ?? "HTTP_ERROR",
      body?.error.message ?? "Something went wrong.",
      body?.error.details,
    );
  }
  return (await res.json()) as T;
}

export function useCart() {
  return useQuery({ queryKey: cartKey, queryFn: () => apiFetch<CartDTO>("/cart") });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddCartItemInput) => apiFetch<CartDTO>("/cart/items", { method: "POST", body: JSON.stringify(input) }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cartKey });
      const previous = qc.getQueryData<CartDTO>(cartKey);
      if (previous) {
        qc.setQueryData<CartDTO>(cartKey, {
          ...previous,
          summary: { ...previous.summary, itemCount: previous.summary.itemCount + input.quantity },
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(cartKey, ctx.previous);
    },
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart);
    },
  });
}

export function useUpdateCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      apiFetch<CartDTO>(`/cart/items/${encodeURIComponent(lineId)}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart);
    },
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<CartDTO>("/cart/coupon", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart);
    },
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CartDTO>("/cart/coupon", { method: "DELETE" }),
    onSuccess: (cart) => {
      qc.setQueryData(cartKey, cart);
    },
  });
}
