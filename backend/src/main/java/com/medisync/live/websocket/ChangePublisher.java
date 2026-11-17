package com.medisync.live.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/** Small helper so services raise change events in one line. Must be called inside a transaction. */
@Component
@RequiredArgsConstructor
public class ChangePublisher {

    private final ApplicationEventPublisher publisher;

    public void request(String type, Long id) {
        publisher.publishEvent(new DataChangedEvent(type, "REQUEST", id));
    }

    public void inventory(String type, Long id) {
        publisher.publishEvent(new DataChangedEvent(type, "INVENTORY", id));
    }

    public void transfer(String type, Long id) {
        publisher.publishEvent(new DataChangedEvent(type, "TRANSFER", id));
    }
}
