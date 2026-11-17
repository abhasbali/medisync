package com.medisync.live.dto;

import com.medisync.live.enums.ResourceType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTransferRequest(
        @NotNull(message = "Requesting hospital is required")
        Long requesterHospitalId,

        @NotNull(message = "Donor hospital is required")
        Long donorHospitalId,

        @NotNull(message = "Resource type is required")
        ResourceType resourceType,

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be a whole number of at least 1")
        @Max(value = 1000, message = "Quantity must be at most 1000")
        Integer quantity,

        @Size(max = 500, message = "Note must be at most 500 characters")
        String note) {
}
