package com.medisync.live.dto;

import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;

import java.time.Instant;

public record EmergencyRequestDto(
        Long id,
        String patientName,
        int patientAge,
        String patientCondition,
        Severity severity,
        ResourceType resourceType,
        double latitude,
        double longitude,
        RequestStatus status,
        Long hospitalId,
        String hospitalName,
        String hospitalArea,
        String hospitalPhone,
        Double distanceKm,
        Instant createdAt,
        Instant allocatedAt,
        Instant completedAt,
        Integer queuePosition) {
}
