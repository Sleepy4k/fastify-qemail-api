const BASE = "https://api.cloudflare.com/client/v4";

export interface CfCredentials {
  apiToken: string;
  accountId?: string;
}

export function resolveCreds(
  domain: {
    cf_api_token?: string | null;
    cf_account_id?: string | null;
  } = {},
  defaults: { apiToken?: string; accountId?: string } = {},
): CfCredentials {
  return {
    apiToken: domain.cf_api_token ?? defaults.apiToken ?? "",
    accountId: domain.cf_account_id ?? defaults.accountId,
  };
}

export function resolveWorkerName(
  domainWorkerName?: string | null,
  defaultWorkerName = "",
): string {
  return domainWorkerName ?? defaultWorkerName;
}

async function cfFetch<T>(
  path: string,
  creds: CfCredentials,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
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

export interface CfZone {
  id: string;
  name: string;
  status: string;
}

export async function getZone(
  zoneId: string,
  creds: CfCredentials,
): Promise<CfZone> {
  return cfFetch<CfZone>(`/zones/${zoneId}`, creds);
}

export async function verifyZone(
  zoneId: string,
  creds: CfCredentials,
): Promise<boolean> {
  try {
    const zone = await getZone(zoneId, creds);
    return zone.status === "active";
  } catch {
    return false;
  }
}

export interface CfEmailRoutingSettings {
  id: string;
  name: string;
  enabled: boolean;
  status: string;
  created: string;
  modified: string;
}

export async function getEmailRoutingSettings(
  zoneId: string,
  creds: CfCredentials,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing`,
    creds,
  );
}

export async function enableEmailRouting(
  zoneId: string,
  creds: CfCredentials,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing/enable`,
    creds,
    { method: "POST" },
  );
}

export async function disableEmailRouting(
  zoneId: string,
  creds: CfCredentials,
): Promise<CfEmailRoutingSettings> {
  return cfFetch<CfEmailRoutingSettings>(
    `/zones/${zoneId}/email/routing/disable`,
    creds,
    { method: "POST" },
  );
}

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
  name: string;
  toAddress: string;
  forwardTo: string;
  useWorker?: boolean;
  priority?: number;
}

export async function listEmailRules(
  zoneId: string,
  creds: CfCredentials,
): Promise<CfRoutingRule[]> {
  return cfFetch<CfRoutingRule[]>(
    `/zones/${zoneId}/email/routing/rules`,
    creds,
  );
}

export async function createEmailRule(
  zoneId: string,
  input: CreateRoutingRuleInput,
  creds: CfCredentials,
): Promise<CfRoutingRule> {
  const body = {
    name: input.name,
    enabled: true,
    priority: input.priority ?? 10,
    matchers: [{ type: "literal", field: "to", value: input.toAddress }],
    actions: [
      {
        type: input.useWorker ? "worker" : "forward",
        value: [input.forwardTo],
      },
    ],
  };
  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules`,
    creds,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function updateEmailRule(
  zoneId: string,
  ruleId: string,
  patch: Partial<
    Pick<
      CfRoutingRule,
      "name" | "enabled" | "priority" | "matchers" | "actions"
    >
  >,
  creds: CfCredentials,
): Promise<CfRoutingRule> {
  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules/${ruleId}`,
    creds,
    { method: "PUT", body: JSON.stringify(patch) },
  );
}

export async function deleteEmailRule(
  zoneId: string,
  ruleId: string,
  creds: CfCredentials,
): Promise<CfRoutingRule> {
  return cfFetch<CfRoutingRule>(
    `/zones/${zoneId}/email/routing/rules/${ruleId}`,
    creds,
    { method: "DELETE" },
  );
}

export interface CfDestinationAddress {
  id: string;
  email: string;
  verified: string | null;
  created: string;
  modified: string;
}

export async function listDestinationAddresses(
  creds: CfCredentials,
): Promise<CfDestinationAddress[]> {
  const accountId = creds.accountId;
  if (!accountId) throw new Error("Cloudflare accountId is required");
  return cfFetch<CfDestinationAddress[]>(
    `/accounts/${accountId}/email/routing/addresses`,
    creds,
  );
}

export async function createDestinationAddress(
  email: string,
  creds: CfCredentials,
): Promise<CfDestinationAddress> {
  const accountId = creds.accountId;
  if (!accountId) throw new Error("Cloudflare accountId is required");
  return cfFetch<CfDestinationAddress>(
    `/accounts/${accountId}/email/routing/addresses`,
    creds,
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export async function deleteDestinationAddress(
  addressId: string,
  creds: CfCredentials,
): Promise<CfDestinationAddress> {
  const accountId = creds.accountId;
  if (!accountId) throw new Error("Cloudflare accountId is required");
  return cfFetch<CfDestinationAddress>(
    `/accounts/${accountId}/email/routing/addresses/${addressId}`,
    creds,
    { method: "DELETE" },
  );
}
