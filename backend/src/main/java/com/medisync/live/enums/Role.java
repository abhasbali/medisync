package com.medisync.live.enums;

public enum Role {
    /** Full access, manages users. */
    ADMIN,
    /** Creates, discharges and cancels emergency requests. */
    DISPATCHER,
    /** Manages the inventory and transfers of one hospital. */
    HOSPITAL_STAFF
}
