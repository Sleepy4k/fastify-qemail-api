import { env } from "../config/env.ts";

const BASE = "https://api.cloudflare.com/client/v4";

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const json = (await res.json()) as {
    success: boolean;
    result: T;
    errors: Array<{ message: string; code?: number }>;
  };

  if (!json.success) {
    const msg = json.errors.map((e) => e.message).join(", ");
    throw new Error(`Cloudflare API: ${msg}`);
  }

  return json.result;
}

// ─── Zone ────────────────────────────────────────────────────────────────────

export interface CfZone {
  id: string;
  name: string;
  status: string;
}

export async function getZone(zoneId: string): Promise<CfZone> {
  return cfFetch<CfZone>(`/zones/${zoneId}`);
}

export async function verifyZone(zoneId: string): Promise<boolean> {
  try {
    const zone = await getZone(zoneId);
    return zone.status === "active";
  } catch {
    return false;
  }
}

// ─── Email Routing – zone-level settings ─────────────────────────────────────

export interface CfEmailRoutingSettings {
  id: string;
  name: string;
  enabled: boolean;
  status: string;
  created: string;
  modified: string;
}

/** Get email routing settings for zone. */
export async function getEmailRoutingSettings(
  zoneId: string,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing`,
  );
}

/** Enable email routing for zone (idempotent). */
export async function enableEmailRouting(
  zoneId: string,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing/enable`,
    { method: "POST" },
  );
}

/** Disable email routing for zone. */
export async function disableEmailRouting(
  zoneId: string,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing/disable`,
    { method: "POST" },
  );
}

// ─── Email Routing – address rules ───────────────────────────────────────────

export interface CfRoutingRuleAction {
  type: "forward" | "worker" | "drop";
  value?: string[];
}

export interface CfRoutingRuleMatcher {
  type: "literal" | "all";
  field?: "to";
  value?: string;
}

export interface CfRoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchers: CfRoutingRuleMatcher[];
  actions: CfRoutingRuleAction[];
}

export interface CreateRoutingRuleInput {
  /** Human-readable name for the rule. */
  name: string;
  /** Recipient address to match (e.g. alice@example.com). */
  toAddress: string;
  /**
   * Where to forward the email.
   * For Worker-based routing supply a Worker name; for direct forward supply a
   * verified destination address.
   */
  forwardTo: string;
  /** Whether to use a Cloudflare Worker instead of direct forwarding. */
  useWorker?: boolean;
  priority?: number;
}

/** List all email routing rules for a zone. */
export async function listEmailRules(zoneId: string): Promise<CfRoutingRule[]> {
  return cfFetch<CfRoutingRule[]>(
    `/zones/${zoneId}/email/routing/rules`,
  );
}

/**
 * Create an email routing rule that forwards a specific address to either a
 * Cloudflare Worker or a destination email address.
 */
export async function createEmailRule(
  zoneId: string,
  input: CreateRoutingRuleInput,
): Promise<CfRoutingRule> {
  const body = {
    name: input.name,
    enabled: true,
    priority: input.priority ?? 10,
    matchers: [
      {
        type: "literal",
        field: "to",
        value: input.toAddress,
      },
    ],
    actions: [
      {
        type: input.useWorker ? "worker" : "forward",
        value: [input.forwardTo],
      },
    ],
  };

  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** Update an existing email routing rule (e.g. enable/disable). */
export async function updateEmailRule(
  zoneId: string,
  ruleId: string,
  patch: Partial<Pick<CfRoutingRule, "name" | "enabled" | "priority" | "matchers" | "actions">>,
): Promise<CfRoutingRule> {
  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules/${ruleId}`,
    { method: "PUT", body: JSON.stringify(patch) },
  );
}

/** Delete an email routing rule. */
export async function deleteEmailRule(
  zoneId: string,
  ruleId: string,
): Promise<CfRoutingRule> {
  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules/${ruleId}`,
    { method: "DELETE" },
  );
}

// ─── Destination addresses (verified forwarding targets) ─────────────────────

export interface CfDestinationAddress {
  id: string;
  email: string;
  verified: string | null;
  created: string;
  modified: string;
}

/** List all verified destination addresses for the account. */
export async function listDestinationAddresses(): Promise<
  CfDestinationAddress[]
> {
  return cfFetch<CfDestinationAddress[]>(
    `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`,
  );
}

/** Create (and trigger verification of) a destination address. */
export async function createDestinationAddress(
  email: string,
): Promise<CfDestinationAddress> {
  return cfFetch<CfDestinationAddress>(
    `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`,
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

/** Delete a destination address. */
export async function deleteDestinationAddress(
  addressId: string,
): Promise<CfDestinationAddress> {
  return cfFetch<CfDestinationAddress>(
    `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses/${addressId}`,
    { method: "DELETE" },
  );
}
