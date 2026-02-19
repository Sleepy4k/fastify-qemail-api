import * as argon2 from "argon2";
import { customAlphabet } from "nanoid";

const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const generateId = customAlphabet(alphabet, 12);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function randomUsername(): string {
  return generateId();
}

export function randomToken(): string {
  return customAlphabet(alphabet + "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 48)();
}

/** Menghasilkan string hex acak sepanjang `bytes * 2` karakter (e.g. 16 → 32 chars = 128-bit entropy) */
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
