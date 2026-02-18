-- Migration 002: Add Cloudflare sync fields
-- Tracks CF Email Routing rule IDs so rules can be deleted when accounts/domains are removed.

-- Store the CF routing rule ID on each temp email account.
-- Nullable so rows created before this migration are not broken.
ALTER TABLE accounts
    ADD COLUMN cloudflare_rule_id VARCHAR(64) DEFAULT NULL AFTER session_token,
    ADD INDEX idx_cf_rule (cloudflare_rule_id);

-- Store whether email routing is currently active on the CF zone for this domain.
ALTER TABLE domains
    ADD COLUMN cloudflare_routing_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER cloudflare_zone_id;
