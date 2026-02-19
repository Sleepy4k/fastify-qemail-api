CREATE TABLE IF NOT EXISTS email_attachments (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email_id      BIGINT UNSIGNED NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(120) NOT NULL UNIQUE,
    mime_type     VARCHAR(128) NOT NULL,
    size          INT UNSIGNED NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE,
    INDEX idx_email_id   (email_id),
    INDEX idx_stored_name (stored_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
