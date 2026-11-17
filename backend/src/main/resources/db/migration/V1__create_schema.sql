-- MediSync Live schema: the five tables of the project report (Table 2.3).

CREATE TABLE hospitals (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120) NOT NULL,
    area        VARCHAR(80)  NOT NULL,
    phone       VARCHAR(30)  NOT NULL,
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_hospitals_name UNIQUE (name),
    CONSTRAINT chk_hospitals_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_hospitals_lng CHECK (longitude BETWEEN -180 AND 180)
) ENGINE = InnoDB;

CREATE TABLE inventory (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    hospital_id    BIGINT      NOT NULL,
    resource_type  ENUM('EMERGENCY','ICU','VENTILATOR','GENERAL','OXYGEN') NOT NULL,
    total          INT         NOT NULL DEFAULT 0,
    available      INT         NOT NULL DEFAULT 0,
    updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_inventory_hospital_type UNIQUE (hospital_id, resource_type),
    CONSTRAINT fk_inventory_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE,
    CONSTRAINT chk_inventory_total CHECK (total >= 0),
    CONSTRAINT chk_inventory_available CHECK (available >= 0 AND available <= total)
) ENGINE = InnoDB;

CREATE INDEX idx_inventory_type ON inventory (resource_type, id);

CREATE TABLE emergency_requests (
    id                     BIGINT       NOT NULL AUTO_INCREMENT,
    patient_name           VARCHAR(100) NOT NULL,
    patient_age            INT          NOT NULL,
    patient_condition      VARCHAR(255) NOT NULL,
    severity               ENUM('CRITICAL','SERIOUS','STABLE') NOT NULL,
    resource_type          ENUM('EMERGENCY','ICU','VENTILATOR','GENERAL','OXYGEN') NOT NULL,
    latitude               DECIMAL(9,6) NOT NULL,
    longitude              DECIMAL(9,6) NOT NULL,
    status                 ENUM('PENDING','ALLOCATED','DISCHARGED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    allocated_hospital_id  BIGINT       NULL,
    allocated_distance_km  DECIMAL(8,2) NULL,
    created_at             DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    allocated_at           DATETIME(6)  NULL,
    completed_at           DATETIME(6)  NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_requests_hospital FOREIGN KEY (allocated_hospital_id) REFERENCES hospitals (id),
    CONSTRAINT chk_requests_age CHECK (patient_age BETWEEN 0 AND 130),
    CONSTRAINT chk_requests_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_requests_lng CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_requests_allocation CHECK (
        (status = 'PENDING' AND allocated_hospital_id IS NULL)
        OR (status = 'ALLOCATED' AND allocated_hospital_id IS NOT NULL)
        OR status IN ('DISCHARGED','CANCELLED'))
) ENGINE = InnoDB;

-- Queue scans: pending requests of one type in priority order.
CREATE INDEX idx_requests_queue ON emergency_requests (status, resource_type, severity, created_at, id);
-- Consistency checks: active allocations per hospital and type.
CREATE INDEX idx_requests_hospital ON emergency_requests (allocated_hospital_id, resource_type, status);
CREATE INDEX idx_requests_created ON emergency_requests (created_at);

CREATE TABLE transfer_requests (
    id                     BIGINT       NOT NULL AUTO_INCREMENT,
    requester_hospital_id  BIGINT       NOT NULL,
    donor_hospital_id      BIGINT       NOT NULL,
    resource_type          ENUM('EMERGENCY','ICU','VENTILATOR','GENERAL','OXYGEN') NOT NULL,
    quantity               INT          NOT NULL,
    note                   VARCHAR(500) NULL,
    status                 ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at             DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    resolved_at            DATETIME(6)  NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_transfer_requester FOREIGN KEY (requester_hospital_id) REFERENCES hospitals (id),
    CONSTRAINT fk_transfer_donor FOREIGN KEY (donor_hospital_id) REFERENCES hospitals (id),
    CONSTRAINT chk_transfer_quantity CHECK (quantity > 0),
    CONSTRAINT chk_transfer_distinct CHECK (requester_hospital_id <> donor_hospital_id)
) ENGINE = InnoDB;

CREATE INDEX idx_transfer_status ON transfer_requests (status, created_at);

CREATE TABLE activity_log (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    action_type   VARCHAR(40)  NOT NULL,
    message       VARCHAR(500) NOT NULL,
    reference_id  BIGINT       NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id)
) ENGINE = InnoDB;

CREATE INDEX idx_activity_created ON activity_log (created_at, id);
