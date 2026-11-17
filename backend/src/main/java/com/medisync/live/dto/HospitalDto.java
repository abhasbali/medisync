package com.medisync.live.dto;

import java.time.Instant;
import java.util.List;

public record HospitalDto(
        Long id,
        String name,
        String area,
        String phone,
        double latitude,
        double longitude,
        Instant createdAt,
        int totalCapacity,
        int totalAvailable,
        List<InventoryDto> inventory) {
}
