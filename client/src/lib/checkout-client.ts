"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthorizeResultDTO, CheckoutOrderDTO, OrderDetailDTO, PaymentMethodValue } from "@nestama/shared";
import { apiFetch, cartKey } from "./cart-client";
import { accountKeys } from "./account-client";

/** The pieces of an order the payment window needs. */
export type PayableOrder = CheckoutOrderDTO;

export function useCreateCheckoutOrder() {
  return useMutation({
    mutationFn: (addressId: string) =>
      apiFetch<CheckoutOrderDTO>("/checkout/orders", { method: "POST", body: JSON.stringify({ addressId }) }),
  });
}

export type PaymentResult = { ok: true; order: OrderDetailDTO } | { ok: false; reason: string };

/**
 * The NestaPay demo round trip (spec §7): the "gateway" authorises (or declines, when simulating a
 * failure), then our server verifies the signature and settles the order. Only the chosen method
 * and outcome are sent — never anything typed into the payment form.
 */
export function usePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order,
      method,
      outcome,
    }: {
      order: PayableOrder;
      method: PaymentMethodValue;
      outcome: "success" | "failure";
    }): Promise<PaymentResult> => {
      const auth = await apiFetch<AuthorizeResultDTO>("/payments/demo/authorize", {
        method: "POST",
        body: JSON.stringify({ gatewayOrderId: order.gatewayOrderId, method, outcome }),
      });
      if (auth.status === "failed") return { ok: false, reason: auth.reason };
      const paid = await apiFetch<OrderDetailDTO>("/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.orderId,
          gatewayOrderId: order.gatewayOrderId,
          gatewayPaymentId: auth.gatewayPaymentId,
          signature: auth.signature,
        }),
      });
      return { ok: true, order: paid };
    },
    onSettled: (_data, _err, { order }) => {
      void qc.invalidateQueries({ queryKey: cartKey });
      void qc.invalidateQueries({ queryKey: ["account", "orders"] });
      void qc.invalidateQueries({ queryKey: accountKeys.order(order.orderId) });
    },
  });
}
