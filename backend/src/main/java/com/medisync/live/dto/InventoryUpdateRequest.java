package com.medisync.live.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record InventoryUpdateRequest(
        @NotNull(message = "Total is required")
        @Min(value = 0, message = "Total must be zero or more")
        @Max(value = 100000, message = "Total must be at most 100000")
        Integer total,

        @NotNull(message = "Available is required")
        @Min(value = 0, message = "Available must be zero or more")
        @Max(value = 100000, message = "Available must be at most 100000")
        Integer available) {
}
