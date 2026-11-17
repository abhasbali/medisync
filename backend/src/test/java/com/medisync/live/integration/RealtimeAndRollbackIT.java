package com.medisync.live.integration;

import com.medisync.live.dto.CreateTransferRequest;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.TransferService;
import com.medisync.live.support.AbstractIntegrationTest;
import com.medisync.live.support.TestRequests;
import com.medisync.live.websocket.RealtimeNotifier;
import com.medisync.live.websocket.UpdateMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static com.medisync.live.support.Areas.T_NAGAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** WebSocket notifications are sent only for committed changes; failed transactions leave counts intact. */
class RealtimeAndRollbackIT extends AbstractIntegrationTest {

    @Autowired
    EmergencyService emergencyService;
    @Autowired
    TransferService transferService;
    @Autowired
    TransactionTemplate transactionTemplate;

    @LocalServerPort
    int port;

    @Test
    @DisplayName("TC 1.4: a STOMP client subscribed to /topic/updates receives the change after commit")
    void stompClientReceivesUpdate() throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter(objectMapper));
        BlockingQueue<UpdateMessage> received = new LinkedBlockingQueue<>();
        StompSession session = client.connectAsync("ws://localhost:" + port + "/ws", new StompSessionHandlerAdapter() {
        }).get(10, TimeUnit.SECONDS);
        session.subscribe(RealtimeNotifier.TOPIC, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return UpdateMessage.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                received.add((UpdateMessage) payload);
            }
        });
        Thread.sleep(300); // let the SUBSCRIBE frame reach the broker

        long id = emergencyService.create(TestRequests.patient("Test Live", Severity.SERIOUS, ResourceType.ICU, T_NAGAR))
                .request().id();

        UpdateMessage first = received.poll(10, TimeUnit.SECONDS);
        assertThat(first).isNotNull();
        assertThat(first.entity()).isEqualTo("REQUEST");
        assertThat(first.referenceId()).isEqualTo(id);
        session.disconnect();
        client.stop();
    }

    @Test
    @DisplayName("Successful operations publish refresh notifications after commit")
    void successfulCommitPublishes() {
        emergencyService.create(TestRequests.patient("Test Publish", Severity.STABLE, ResourceType.GENERAL, T_NAGAR));
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq(RealtimeNotifier.TOPIC),
                argThat((Object m) -> m instanceof UpdateMessage u && "ALLOCATED".equals(u.type())));
    }

    @Test
    @DisplayName("A rejected approval (rolled back) publishes nothing and leaves inventory unchanged")
    void rolledBackApprovalPublishesNothing() {
        long id = transferService.create(new CreateTransferRequest(hospitalId("Fortis Malar Hospital"),
                hospitalId("Government General Hospital"), ResourceType.VENTILATOR, 50, null)).id();
        clearInvocations(messagingTemplate);

        assertThatThrownBy(() -> transferService.approve(id))
                .isInstanceOf(com.medisync.live.exception.ConflictException.class);

        verify(messagingTemplate, never()).convertAndSend(eq(RealtimeNotifier.TOPIC), any(Object.class));
        assertThat(total("Government General Hospital", "VENTILATOR")).isEqualTo(20);
        assertThat(total("Fortis Malar Hospital", "VENTILATOR")).isEqualTo(10);
    }

    @Test
    @DisplayName("Failure after an allocation inside one transaction rolls everything back, with no event")
    void failureMidTransactionRollsBack() {
        int before = available("Kauvery Hospital", "ICU");
        long requestsBefore = jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests", Long.class);
        long logBefore = jdbc.queryForObject("SELECT COUNT(*) FROM activity_log", Long.class);

        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(tx -> {
            var result = emergencyService.create(TestRequests.patient("Test Rollback", Severity.CRITICAL, ResourceType.ICU, T_NAGAR));
            assertThat(result.allocated()).isTrue(); // the bed was reserved inside the transaction...
            throw new IllegalStateException("simulated failure before commit");
        })).isInstanceOf(IllegalStateException.class);

        // ...but nothing survived the rollback, and no client was told about it.
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests", Long.class)).isEqualTo(requestsBefore);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM activity_log", Long.class)).isEqualTo(logBefore);
        verify(messagingTemplate, never()).convertAndSend(eq(RealtimeNotifier.TOPIC), any(Object.class));
    }

    @Test
    @DisplayName("Invalid inventory edits publish nothing")
    void invalidInventoryEditPublishesNothing() throws Exception {
        long id = inventoryId("Apollo Hospitals", "ICU");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/inventory/" + id)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"total\": 5, \"available\": 6}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
        verify(messagingTemplate, never()).convertAndSend(eq(RealtimeNotifier.TOPIC), any(Object.class));
    }
}
