package com.medisync.live.enums;

/** The five shared resource types of the report. Declaration order is the display order. */
public enum ResourceType {
    EMERGENCY("Emergency bed"),
    ICU("ICU bed"),
    VENTILATOR("Ventilator"),
    GENERAL("General bed"),
    OXYGEN("Oxygen-supported bed");

    private final String label;

    ResourceType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
