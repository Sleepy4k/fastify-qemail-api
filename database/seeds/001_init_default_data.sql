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

INSERT INTO
    admin_users (username, password_hash, role)
VALUES (
        'admin',
        '$argon2id$v=19$m=65536,t=3,p=4$JMC76kuLaS7xNfwiDhz1mQ$2CE3+r/NhX1UxFcM1oMD7euUXGAhtjKV69ET3EWodIQ',
        'superadmin'
    )
ON DUPLICATE KEY UPDATE
    username = VALUES(username);