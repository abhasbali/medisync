package com.medisync.live.dto;

import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import jakarta.validation.constraints.*;

public record CreateEmergencyRequest(
        @NotBlank(message = "Patient name is required")
        @Size(max = 100, message = "Patient name must be at most 100 characters")
        String patientName,

        @NotNull(message = "Patient age is required")
        @Min(value = 0, message = "Patient age must be between 0 and 130")
        @Max(value = 130, message = "Patient age must be between 0 and 130")
        Integer patientAge,

        @NotBlank(message = "Medical condition is required")
        @Size(max = 255, message = "Medical condition must be at most 255 characters")
        String patientCondition,

        @NotNull(message = "Severity is required")
        Severity severity,

        @NotNull(message = "Resource type is required")
        ResourceType resourceType,

        @NotNull(message = "Latitude is required")
        @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
        @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
        Double latitude,

        @NotNull(message = "Longitude is required")
        @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
        @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
        Double longitude) {
}
