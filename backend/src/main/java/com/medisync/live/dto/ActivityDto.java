package com.medisync.live.dto;

import com.medisync.live.enums.ActivityType;

import java.time.Instant;

public record ActivityDto(Long id, ActivityType actionType, String message, Long referenceId, String actor, Instant createdAt) {
}
