-- Authentication: application users with roles. HOSPITAL_STAFF users are scoped to one hospital.
CREATE TABLE app_users (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    username       VARCHAR(50)  NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    full_name      VARCHAR(100) NOT NULL,
    role           ENUM('ADMIN','DISPATCHER','HOSPITAL_STAFF') NOT NULL,
    hospital_id    BIGINT       NULL,
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    token_version  INT          NOT NULL DEFAULT 0,
    created_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_login_at  DATETIME(6)  NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_app_users_username UNIQUE (username),
    CONSTRAINT fk_app_users_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id),
    CONSTRAINT chk_app_users_staff_hospital CHECK (role <> 'HOSPITAL_STAFF' OR hospital_id IS NOT NULL)
) ENGINE = InnoDB;

-- Audit: who performed each action (NULL for system-triggered entries).
ALTER TABLE activity_log ADD COLUMN actor VARCHAR(50) NULL AFTER reference_id;
