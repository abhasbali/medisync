package com.medisync.live.websocket;

/**
 * Domain event raised inside a transaction when shared data changes. It is delivered to WebSocket
 * clients only after the transaction commits (see {@link RealtimeNotifier}).
 *
 * @param type        what happened, e.g. ALLOCATED, INVENTORY_UPDATED, TRANSFER_APPROVED
 * @param entity      the kind of record affected: REQUEST, INVENTORY or TRANSFER
 * @param referenceId id of the affected record
 */
public record DataChangedEvent(String type, String entity, Long referenceId) {
}
