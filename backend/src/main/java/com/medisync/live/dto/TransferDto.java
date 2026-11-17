package com.medisync.live.dto;

import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.TransferStatus;

import java.time.Instant;

public record TransferDto(
        Long id,
        Long requesterHospitalId,
        String requesterHospitalName,
        Long donorHospitalId,
        String donorHospitalName,
        ResourceType resourceType,
        int quantity,
        String note,
        TransferStatus status,
        Instant createdAt,
        Instant resolvedAt) {
}
