package com.medisync.live.enums;

/** Patient severity. Lower {@link #priority()} is served first. */
public enum Severity {
    CRITICAL(0),
    SERIOUS(1),
    STABLE(2);

    private final int priority;

    Severity(int priority) {
        this.priority = priority;
    }

    public int priority() {
        return priority;
    }
}
