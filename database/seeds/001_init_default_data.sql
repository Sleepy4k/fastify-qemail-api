-- ═══════════════════════════════════════════════════════════════════
-- DEFAULT DATA
-- ═══════════════════════════════════════════════════════════════════

-- Insert default settings
INSERT INTO
    settings (`key`, value)
VALUES ('max_emails_per_ip', '10'),
    ('email_expiry_hours', '24'),
    (
        'registration_enabled',
        'true'
    )
ON DUPLICATE KEY UPDATE
    value = VALUES(value);

-- Insert default domains (update with your actual domains)
INSERT INTO
    domains (
        name,
        cloudflare_zone_id,
        is_active
    )
VALUES ('tempmail.local', NULL, TRUE),
    ('throwaway.local', NULL, TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name);

-- Insert default admin (username: admin, password: Admin@123456)
-- ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!
INSERT INTO
    admin_users (username, password_hash, role)
VALUES (
        'admin',
        '$argon2id$v=19$m=65536,t=3,p=4$TQBl/SZnG6zJ/pLJGN/F5g$8xKJHxVzGr2z0P+pR3YJb9wQDQxZ3p4VQh5zJYxK7Ks',
        'superadmin'
    )
ON DUPLICATE KEY UPDATE
    username = VALUES(username);