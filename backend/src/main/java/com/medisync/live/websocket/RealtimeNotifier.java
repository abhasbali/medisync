package com.medisync.live.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;

/**
 * Bridges committed domain events to STOMP subscribers. Because the listener runs in the
 * AFTER_COMMIT phase, a rolled-back operation never produces a refresh notification.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeNotifier {

    public static final String TOPIC = "/topic/updates";

    private final SimpMessagingTemplate messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDataChanged(DataChangedEvent event) {
        UpdateMessage message = new UpdateMessage(event.type(), event.entity(), event.referenceId(), Instant.now());
        try {
            messagingTemplate.convertAndSend(TOPIC, message);
            log.debug("Broadcast {} #{} to {}", event.type(), event.referenceId(), TOPIC);
        } catch (RuntimeException ex) {
            // The data change is already committed; a broadcast failure must not surface as an API error.
            log.warn("Failed to broadcast {} #{}: {}", event.type(), event.referenceId(), ex.getMessage());
        }
    }
}
