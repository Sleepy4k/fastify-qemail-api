/**
 * QEmail – Cloudflare Email Worker
 *
 * Receives emails via Cloudflare Email Routing, parses the raw MIME message,
 * and forwards a structured JSON payload to the Fastify backend webhook.
 *
 * Environment variables (set via `wrangler secret put` or the CF dashboard):
 *   API_ENDPOINT   – Full webhook URL, e.g.
 *                    https://api.yourdomain.com/api/v1/webhook/incoming-email
 *   WEBHOOK_SECRET – Shared secret; must match CF_WEBHOOK_SECRET in backend .env
 */

export interface Env {
  API_ENDPOINT: string;
  WEBHOOK_SECRET: string;
}

/** Cloudflare Workers execution context. */
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Subset of the ForwardableEmailMessage exposed by the Workers runtime. */
interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
}

/** Payload sent to the backend webhook – matches the IncomingEmailBody schema. */
interface WebhookPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers: Record<string, string | string[]>;
  messageId: string;
  receivedAt: string;
}

// ─── Worker entry-point ───────────────────────────────────────────────────────

export default {
  async email(
    message: EmailMessage,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.API_ENDPOINT || !env.WEBHOOK_SECRET) {
      console.error(
        "[qemail-worker] API_ENDPOINT or WEBHOOK_SECRET is not configured",
      );
      return;
    }

    let payload: WebhookPayload;
    try {
      payload = await buildPayload(message);
    } catch (err) {
      console.error("[qemail-worker] Failed to parse email:", err);
      throw err; // causes CF to retry delivery
    }

    const res = await fetch(env.API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header name must match what WebhookController reads: x-webhook-secret
        "X-Webhook-Secret": env.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`[qemail-worker] Backend ${res.status}: ${body}`);
      throw new Error(`Backend error ${res.status}`);
    }

    console.log(`[qemail-worker] Delivered ${payload.messageId} → ${payload.to}`);
  },
};

// ─── Email building ───────────────────────────────────────────────────────────

async function buildPayload(message: EmailMessage): Promise<WebhookPayload> {
  // Normalise all headers into a lowercase-keyed object; duplicate → array
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of message.headers) {
    const k = key.toLowerCase();
    const existing = headers[k];
    if (existing === undefined) {
      headers[k] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      headers[k] = [existing, value];
    }
  }

  const subject =
    (message.headers.get("subject") ?? "").trim() || "(No Subject)";

  const messageId =
    (message.headers.get("message-id") ?? "").trim() ||
    `<${Date.now()}.${Math.random().toString(36).slice(2)}@qemail.worker>`;

  // Read the full raw RFC-2822 message (headers + blank line + body)
  const raw = await readStream(message.raw);

  // Locate end of header block (first occurrence of \r\n\r\n or \n\n)
  const crlfIdx = raw.indexOf("\r\n\r\n");
  const lfIdx   = raw.indexOf("\n\n");
  const breakAt =
    crlfIdx !== -1 && (lfIdx === -1 || crlfIdx < lfIdx) ? crlfIdx : lfIdx;

  const rawBody = breakAt !== -1 ? raw.slice(breakAt + (crlfIdx === breakAt ? 4 : 2)) : raw;

  const contentType = message.headers.get("content-type") ?? "";
  const { text, html } = extractParts(rawBody, contentType);

  return {
    from: message.from,
    to: message.to,
    subject,
    text,
    html,
    headers,
    messageId,
    receivedAt: new Date().toISOString(),
  };
}

// ─── Stream helper ────────────────────────────────────────────────────────────

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader  = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const chunks: string[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode()); // flush remainder
  return chunks.join("");
}

// ─── MIME parsing ─────────────────────────────────────────────────────────────

interface Parts { text?: string; html?: string }

/**
 * Recursively extract text/plain and text/html from a MIME body string.
 * `contentType` is the value of the Content-Type header for the current part.
 */
function extractParts(body: string, contentType: string): Parts {
  const ct = contentType.toLowerCase();

  if (ct.startsWith("multipart/")) {
    const boundary = parseBoundary(contentType);
    if (boundary) return parseMultipart(body, boundary);
    return {};
  }

  if (ct.startsWith("text/html")) {
    return { html: decodePart(body, contentType) };
  }

  // text/plain, empty content-type (plain fallback), or unrecognised
  return { text: decodePart(body, contentType) };
}

/** Extract boundary= parameter value from a Content-Type header. */
function parseBoundary(ct: string): string | undefined {
  const m = ct.match(/boundary\s*=\s*"?([^";\s]+)"?/i);
  return m?.[1];
}

/**
 * Split a multipart body on `boundary` and collect text+html recursively.
 * Multiple text parts are concatenated (handles multipart/alternative etc.).
 */
function parseMultipart(body: string, boundary: string): Parts {
  const delimiter = `--${boundary}`;
  const escaped   = escapeRegExp(delimiter);
  const parts     = body.split(new RegExp(`\\r?\\n${escaped}`));

  let text: string | undefined;
  let html: string | undefined;

  for (const rawPart of parts) {
    // Skip preamble marker, closing boundary, or empty fragment
    const trimmed = rawPart.replace(/^--\r?\n?$/, "").trim();
    if (!trimmed || trimmed === "--") continue;

    // Split off part headers
    const crlfBreak = rawPart.indexOf("\r\n\r\n");
    const lfBreak   = rawPart.indexOf("\n\n");
    const breakAt   =
      crlfBreak !== -1 && (lfBreak === -1 || crlfBreak < lfBreak)
        ? crlfBreak
        : lfBreak;

    if (breakAt === -1) continue;

    const partHeaders = rawPart.slice(0, breakAt);
    const partBody    = rawPart.slice(breakAt + (crlfBreak === breakAt ? 4 : 2));
    const partCT      = extractHeaderValue(partHeaders, "content-type");

    const result = extractParts(partBody, partCT);
    if (result.text) text = (text ?? "") + result.text;
    if (result.html) html = (html ?? "") + result.html;
  }

  return { text, html };
}

/** Extract the value of a named header from a raw header block string. */
function extractHeaderValue(block: string, name: string): string {
  const m = block.match(new RegExp(`^${name}\\s*:\\s*(.+)`, "im"));
  if (!m) return "";
  // Unfold any continuation lines (RFC 2822 folded headers)
  return m[1].replace(/\r?\n[ \t]+/g, " ").trim();
}

/**
 * Attempt to decode quoted-printable or base64 transfer encoding.
 * The Workers runtime does not expose CTE per-part, so we apply heuristics.
 */
function decodePart(body: string, _ct: string): string {
  // Heuristic: all-base64-chars with no spaces → likely base64-encoded part
  const stripped = body.replace(/\r?\n/g, "");
  if (stripped.length > 20 && /^[A-Za-z0-9+/]+=*$/.test(stripped)) {
    try {
      return decodeBase64Safe(stripped);
    } catch {
      // not base64 – fall through to QP
    }
  }
  return decodeQP(body);
}

/** Decode quoted-printable encoded string (RFC 2045 §6.7). */
function decodeQP(s: string): string {
  return s
    .replace(/=\r?\n/g, "") // soft line-break
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

/**
 * Decode base64 using the Workers-native `atob`.
 * Handles URL-safe alphabet and strips whitespace first.
 * Returns the decoded UTF-8 text.
 */
function decodeBase64Safe(s: string): string {
  const clean = s.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(clean);
  try {
    // Re-encode as percent-escaped UTF-8 then decode
    return decodeURIComponent(
      binary
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return binary; // non-UTF-8 content: return raw decoded string
  }
}

/** Escape special regex metacharacters in a literal string. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
