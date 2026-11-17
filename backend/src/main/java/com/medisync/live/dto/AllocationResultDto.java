package com.medisync.live.dto;

/** Response of POST /api/requests: whether a bed was reserved, a human-readable message and the request. */
public record AllocationResultDto(boolean allocated, String message, EmergencyRequestDto request) {
}
