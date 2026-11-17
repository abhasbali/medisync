package com.medisync.live.dto;

import com.medisync.live.enums.ResourceType;

import java.util.List;

public record StatsDto(
        long totalCapacity,
        long totalAvailable,
        long activeAdmissions,
        long waitingPatients,
        Double averageDistanceKm,
        long hospitalCount,
        long pendingTransfers,
        List<ResourceSummary> byResource) {

    public record ResourceSummary(ResourceType resourceType, long total, long available) {
    }
}
