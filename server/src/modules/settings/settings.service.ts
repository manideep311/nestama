import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import type { AdminSettingsDTO } from "@nestama/shared";

/** The singleton store settings row. Throws a clear 503 if the database hasn't been seeded. */
export async function getStoreSettingsRow() {
  const s = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  if (!s) throw new AppError("NOT_CONFIGURED", 503, "Store settings are missing. Run the database seed.");
  return s;
}

export type { AdminSettingsDTO };

export async function getAdminSettings(): Promise<AdminSettingsDTO> {
  const { id: _id, updatedAt, ...rest } = await getStoreSettingsRow();
  return { ...rest, updatedAt: updatedAt.toISOString() };
}

export async function updateSettings(data: Omit<AdminSettingsDTO, "updatedAt">): Promise<AdminSettingsDTO> {
  await getStoreSettingsRow();
  await prisma.storeSettings.update({ where: { id: 1 }, data });
  return getAdminSettings();
}
