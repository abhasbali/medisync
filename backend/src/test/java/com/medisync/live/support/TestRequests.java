package com.medisync.live.support;

import com.medisync.live.dto.CreateEmergencyRequest;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;

/** Fictional test patients only. */
public final class TestRequests {

    private TestRequests() {
    }

    public static CreateEmergencyRequest patient(String name, Severity severity, ResourceType type, double[] where) {
        return new CreateEmergencyRequest(name, 45, "Synthetic test condition", severity, type, where[0], where[1]);
    }
}
