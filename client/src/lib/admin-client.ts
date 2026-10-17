"use client";

import { createContext, useContext } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UploadResultDTO } from "@nestama/shared";
import { apiFetch, ApiRequestError } from "./cart-client";

// Admin data. Every key starts with "admin" so a save can refresh just its own lists.

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

/** GET an admin resource; list views keep the previous page on screen while the next one loads. */
/**
 * True once the shell has confirmed an admin session. Pages render (as skeletons) before that, so
 * navigation is instant, but their reads wait for it, so a non-admin never fires one.
 */
export const AdminAccess = createContext(false);

export function useAdminQuery<T>(
  key: readonly unknown[],
  path: string,
  params: Record<string, string | number | undefined | null> = {},
  enabled = true,
) {
  const allowed = useContext(AdminAccess);
  return useQuery({
    queryKey: ["admin", ...key, params],
    queryFn: () => apiFetch<T>(`/admin${path}${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled: allowed && enabled,
  });
}

/** A write that refreshes the given admin query families afterwards. */
export function useAdminMutation<TInput, TResult>(
  request: (input: TInput) => { path: string; method: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown },
  invalidate: string[][],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      const { path, method, body } = request(input);
      return apiFetch<TResult>(`/admin${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    },
    onSuccess: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: ["admin", ...k] }))),
  });
}

/** Multipart upload (no JSON content-type, so the browser sets the boundary). */
export async function uploadImage(file: File): Promise<UploadResultDTO> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiRequestError(res.status, body?.error?.code ?? "UPLOAD_FAILED", body?.error?.message ?? "Upload failed. Please try again.");
  }
  return (await res.json()) as UploadResultDTO;
}

/** A readable message for any admin request failure. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}
