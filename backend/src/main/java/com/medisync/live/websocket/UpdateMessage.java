package com.medisync.live.websocket;

import java.time.Instant;

/** Payload broadcast on /topic/updates. Clients treat it as a signal to reload the affected data. */
public record UpdateMessage(String type, String entity, Long referenceId, Instant timestamp) {
}
