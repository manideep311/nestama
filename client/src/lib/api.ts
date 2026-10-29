import "server-only";
import type { ApiErrorBody } from "@nestama/shared";
import { PROXY_HEADER } from "./proxy-header";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Server-side GET against the Express API (server-to-server, with the secret the API requires). */
export async function apiGet<T>(path: string, init: { cookie?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      headers: {
        accept: "application/json",
        ...(init.cookie ? { cookie: init.cookie } : {}),
        ...(process.env.PROXY_SECRET ? { [PROXY_HEADER]: process.env.PROXY_SECRET } : {}),
      },
    });
  } catch (cause) {
    throw new ApiError(503, "API_UNREACHABLE", `Could not reach the NESTAMA API at ${API_URL}: ${String(cause)}`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error.code ?? "HTTP_ERROR", body?.error.message ?? res.statusText);
  }
  return (await res.json()) as T;
}
