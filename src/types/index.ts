import type { RowDataPacket } from "mysql2/promise";

export interface DomainRow extends RowDataPacket {
  id: number;
  name: string;
  cloudflare_zone_id: string | null;
  cloudflare_routing_enabled: boolean;
  cf_api_token: string | null;
  cf_account_id: string | null;
  cf_worker_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AccountRow extends RowDataPacket {
  id: number;
  email_address: string;
  password_hash: string | null;
  domain_id: number;
  is_custom: boolean;
  session_token: string;
  cloudflare_rule_id: string | null;
  ip_address: string | null;
  expires_at: Date | null;
  forward_to: string | null;
  created_at: Date;
}

export interface EmailRow extends RowDataPacket {
  id: number;
  account_id: number;
  message_id: string;
  sender: string;
  sender_name: string | null;
  recipient: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_headers: string | null;
  is_read: boolean;
  received_at: Date;
}

export interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  role: "superadmin" | "admin";
  is_active: boolean;
  created_at: Date;
}

export interface SettingRow extends RowDataPacket {
  id: number;
  key: string;
  value: string;
  updated_at: Date;
}

export interface CountRow extends RowDataPacket {
  total: number;
}

export interface ActivityLogRow extends RowDataPacket {
  id: number;
  actor_type: "user" | "admin" | "system";
  actor_id: number | null;
  actor_label: string | null;
  action: string;
  status: "success" | "failure";
  resource_type: string | null;
  resource_id: string | null;
  meta: Record<string, unknown> | null; // mysql2 auto-parse kolom JSON
  ip_address: string | null;
  error: string | null;
  created_at: Date;
}

export interface UserPayload {
  sub: number;
  email: string;
  type: "user";
  [key: string]: unknown;
}

export interface AdminPayload {
  sub: number;
  username: string;
  role: string;
  type: "admin";
  [key: string]: unknown;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
