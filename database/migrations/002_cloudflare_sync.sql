ALTER TABLE accounts
    ADD COLUMN cloudflare_rule_id VARCHAR(64) DEFAULT NULL AFTER session_token,
    ADD INDEX idx_cf_rule (cloudflare_rule_id);

ALTER TABLE domains
    ADD COLUMN cloudflare_routing_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER cloudflare_zone_id;
