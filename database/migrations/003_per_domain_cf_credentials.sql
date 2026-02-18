ALTER TABLE domains
    ADD COLUMN cf_api_token   VARCHAR(512) DEFAULT NULL AFTER cloudflare_routing_enabled,
    ADD COLUMN cf_account_id  VARCHAR(64)  DEFAULT NULL AFTER cf_api_token,
    ADD COLUMN cf_worker_name VARCHAR(128) DEFAULT NULL AFTER cf_account_id;
