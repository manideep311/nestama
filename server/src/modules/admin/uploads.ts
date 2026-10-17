import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { imageSize } from "image-size";
import type { UploadResultDTO } from "@nestama/shared";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["jpg", "jpg"],
  ["png", "png"],
  ["webp", "webp"],
  ["avif", "avif"],
]);

/** Multipart parser: one `file` field, kept in memory (≤ 5 MB). */
export const uploadSingle = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single("file");

/** Detects the real image type from the bytes — the browser-supplied MIME type is not trusted. */
function inspect(buffer: Buffer): { ext: string; width: number; height: number } {
  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(buffer);
  } catch {
    throw new AppError("UNSUPPORTED_FILE", 400, "That file isn't an image we can use. Upload a JPG, PNG, WebP or AVIF.");
  }
  const ext = info.type ? ALLOWED.get(info.type) : undefined;
  if (!ext || !info.width || !info.height) {
    throw new AppError("UNSUPPORTED_FILE", 400, "Upload a JPG, PNG, WebP or AVIF image.");
  }
  return { ext, width: info.width, height: info.height };
}

/** cloudinary://<key>:<secret>@<cloud> */
function cloudinaryConfig() {
  if (!env.CLOUDINARY_URL) return null;
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(env.CLOUDINARY_URL);
  return m ? { apiKey: m[1]!, apiSecret: m[2]!, cloud: m[3]! } : null;
}

async function toCloudinary(
  buffer: Buffer,
  ext: string,
  cfg: { apiKey: string; apiSecret: string; cloud: string },
): Promise<UploadResultDTO> {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "nestama";
  const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${cfg.apiSecret}`).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), `upload.${ext}`);
  form.append("api_key", cfg.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new AppError("UPLOAD_FAILED", 502, "The image host rejected the upload. Please try again.");
  const body = (await res.json()) as { secure_url: string; width: number; height: number };
  return { url: body.secure_url, width: body.width, height: body.height };
}

async function toDisk(buffer: Buffer, ext: string, size: { width: number; height: number }): Promise<UploadResultDTO> {
  const month = new Date().toISOString().slice(0, 7);
  const name = `${crypto.randomBytes(12).toString("base64url")}.${ext}`;
  await fs.mkdir(path.join(UPLOAD_DIR, month), { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, month, name), buffer);
  return { url: `/uploads/${month}/${name}`, ...size };
}

/** Stores an admin image upload on Cloudinary when configured, otherwise under server/uploads. */
export async function storeImage(file: Express.Multer.File | undefined): Promise<UploadResultDTO> {
  if (!file) throw new AppError("NO_FILE", 400, "Choose an image to upload.");
  const { ext, width, height } = inspect(file.buffer);
  const cloud = cloudinaryConfig();
  return cloud ? toCloudinary(file.buffer, ext, cloud) : toDisk(file.buffer, ext, { width, height });
}
