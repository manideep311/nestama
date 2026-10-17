import { z } from "./zod";

/** The first message per field from a Zod error — what forms show under each input. */
export function firstFieldErrors(error: z.ZodError): Record<string, string | undefined> {
  const { fieldErrors } = z.flattenError(error) as { fieldErrors: Record<string, string[] | undefined> };
  return Object.fromEntries(Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]]));
}
