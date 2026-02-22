import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomHex } from "./crypto.ts";

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

export class AttachmentStorage {
  constructor(
    private uploadDir: string,
    private uploadBaseUrl: string,
  ) {}

  url(storedName: string): string {
    const base = this.uploadBaseUrl.replace(/\/$/, "");
    return `${base}/v1/files/${storedName}`;
  }

  async save(path: string, filename: string, mimeType: string): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });

    const ext = resolveExt(filename, mimeType);
    const storedName = `${randomHex(16)}${ext}`;
    const fullPath = join(this.uploadDir, storedName);

    let buffer: Buffer;

    if (path.startsWith("data:")) {
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
      buffer = Buffer.from(path, "base64");
    }

    await writeFile(fullPath, buffer);
    return storedName;
  }

  async deleteOne(storedName: string): Promise<void> {
    await unlink(join(this.uploadDir, storedName)).catch(() => undefined);
  }

  deleteMany(storedNames: string[]): void {
    for (const name of storedNames) {
      unlink(join(this.uploadDir, name)).catch(() => undefined);
    }
  }
}
