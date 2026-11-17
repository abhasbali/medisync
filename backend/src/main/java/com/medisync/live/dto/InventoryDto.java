package com.medisync.live.dto;

import com.medisync.live.enums.ResourceType;

import java.time.Instant;

public record InventoryDto(
        Long id,
        Long hospitalId,
        String hospitalName,
        ResourceType resourceType,
        int total,
        int available,
        int occupied,
        long activeAllocations,
        Instant updatedAt) {
}
