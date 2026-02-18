CREATE TABLE IF NOT EXISTS activity_logs (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Siapa yang melakukan aksi
    actor_type  ENUM('user', 'admin', 'system') NOT NULL,
    actor_id    BIGINT UNSIGNED DEFAULT NULL,       -- id dari accounts / admin_users
    actor_label VARCHAR(320) DEFAULT NULL,          -- email user atau username admin (snapshot)

    -- Aksi apa
    action      VARCHAR(64) NOT NULL,               -- e.g. 'email.generate', 'admin.login'
    status      ENUM('success', 'failure') NOT NULL DEFAULT 'success',

    -- Objek yang dikenai aksi
    resource_type VARCHAR(64) DEFAULT NULL,         -- e.g. 'account', 'email', 'domain', 'setting'
    resource_id   VARCHAR(255) DEFAULT NULL,        -- id / message_id / domain_id dsb.

    -- Detail tambahan (JSON bebas, tidak di-index)
    meta        JSON DEFAULT NULL,

    -- Konteks request
    ip_address  VARCHAR(45) DEFAULT NULL,
    error       TEXT DEFAULT NULL,                  -- pesan error jika status = 'failure'

    created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_actor      (actor_type, actor_id),
    INDEX idx_action     (action),
    INDEX idx_resource   (resource_type, resource_id(64)),
    INDEX idx_status     (status),
    INDEX idx_created    (created_at),
    INDEX idx_ip         (ip_address)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
