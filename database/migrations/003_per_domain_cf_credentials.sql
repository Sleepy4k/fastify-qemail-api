-- Migration 003: Per-domain Cloudflare credentials
-- Each domain can now have its own CF API token, account ID, and worker name.
-- When NULL, the backend falls back to the global env vars (CF_API_TOKEN, etc.).

ALTER TABLE domains
    ADD COLUMN cf_api_token   VARCHAR(512) DEFAULT NULL AFTER cloudflare_routing_enabled,
    ADD COLUMN cf_account_id  VARCHAR(64)  DEFAULT NULL AFTER cf_api_token,
    ADD COLUMN cf_worker_name VARCHAR(128) DEFAULT NULL AFTER cf_account_id;
