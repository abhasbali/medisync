package com.medisync.live.entity;

import com.medisync.live.enums.ActivityType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "activity_log")
@Getter
@NoArgsConstructor
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 40)
    private ActivityType actionType;

    @Column(nullable = false, length = 500)
    private String message;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public ActivityLog(ActivityType actionType, String message, Long referenceId) {
        this.actionType = actionType;
        this.message = message.length() > 500 ? message.substring(0, 500) : message;
        this.referenceId = referenceId;
        this.createdAt = Instant.now();
    }
}
