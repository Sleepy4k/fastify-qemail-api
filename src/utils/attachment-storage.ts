import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomHex } from "./crypto.ts";
import { env } from "../config/env.ts";

// ---------- MIME → ekstensi fallback ----------
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg":       ".jpg",
  "image/png":        ".png",
  "image/gif":        ".gif",
  "image/webp":       ".webp",
  "image/svg+xml":    ".svg",
  "image/bmp":        ".bmp",
  "image/tiff":       ".tif",
  "application/pdf":  ".pdf",
  "text/plain":       ".txt",
  "text/html":        ".html",
  "text/csv":         ".csv",
  "application/zip":  ".zip",
  "application/gzip": ".gz",
  "application/json": ".json",
  "application/msword":                                                         ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":   ".docx",
  "application/vnd.ms-excel":                                                   ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         ".xlsx",
  "application/vnd.ms-powerpoint":                                              ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};

function resolveExt(filename: string, mimeType: string): string {
  const fromFilename = extname(filename).toLowerCase();
  if (fromFilename) return fromFilename;
  return MIME_TO_EXT[mimeType] ?? "";
}

// ---------- public API ----------

/** Pastikan direktori upload ada */
export async function ensureUploadDir(): Promise<void> {
  await mkdir(env.UPLOAD_DIR, { recursive: true });
}

/**
 * Simpan satu attachment ke disk.
 * `path` boleh berupa:
 *   - Data URI  → `data:mimeType;base64,<base64data>`
 *   - URL HTTPS → file di-fetch lalu disimpan
 *   - Raw base64 string
 *
 * Return: `stored_name` (nama file acak yang disimpan)
 */
export async function saveAttachment(
  path: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  await ensureUploadDir();

  const ext        = resolveExt(filename, mimeType);
  // 16 bytes = 32 hex chars → 128-bit entropy, sangat susah ditebak
  const storedName = `${randomHex(16)}${ext}`;
  const fullPath   = join(env.UPLOAD_DIR, storedName);

  let buffer: Buffer;

  if (path.startsWith("data:")) {
    // Data URI: ambil bagian setelah koma
    const commaIdx = path.indexOf(",");
    const b64 = commaIdx !== -1 ? path.slice(commaIdx + 1) : path;
    buffer = Buffer.from(b64, "base64");
  } else if (path.startsWith("http://") || path.startsWith("https://")) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Failed to fetch attachment (${res.status}): ${path}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    // Anggap raw base64
    buffer = Buffer.from(path, "base64");
  }

  await writeFile(fullPath, buffer);
  return storedName;
}

/** Hapus file dari disk (silent jika tidak ada) */
export async function deleteAttachmentFile(storedName: string): Promise<void> {
  await unlink(join(env.UPLOAD_DIR, storedName)).catch(() => undefined);
}

/** Hapus banyak file sekaligus (fire-and-forget, tidak pernah throw) */
export function deleteAttachmentFiles(storedNames: string[]): void {
  for (const name of storedNames) {
    unlink(join(env.UPLOAD_DIR, name)).catch(() => undefined);
  }
}

/** Buat URL publik untuk sebuah stored_name */
export function attachmentUrl(storedName: string): string {
  const base = env.UPLOAD_BASE_URL.replace(/\/$/, "");
  return `${base}/v1/files/${storedName}`;
}
