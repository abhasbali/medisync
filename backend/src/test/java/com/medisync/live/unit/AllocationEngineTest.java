package com.medisync.live.unit;

import com.medisync.live.entity.EmergencyRequest;
import com.medisync.live.entity.Hospital;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.repository.EmergencyRequestRepository;
import com.medisync.live.service.ActivityService;
import com.medisync.live.service.AllocationEngine;
import com.medisync.live.websocket.ChangePublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AllocationEngineTest {

    @Mock
    EmergencyRequestRepository requestRepository;
    @Mock
    ActivityService activityService;
    @Mock
    ChangePublisher changes;
    @InjectMocks
    AllocationEngine engine;

    private Hospital kauvery;
    private Hospital apollo;
    private Hospital srmc;
    private long nextId = 1;

    @BeforeEach
    void setUp() {
        kauvery = hospital(4L, "Kauvery Hospital", 13.0336, 80.2535);
        apollo = hospital(1L, "Apollo Hospitals", 13.0604, 80.2496);
        srmc = hospital(6L, "Sri Ramachandra Medical Centre", 13.0382, 80.1420);
    }

    private static Hospital hospital(long id, String name, double lat, double lng) {
        Hospital h = new Hospital();
        h.setId(id);
        h.setName(name);
        h.setLatitude(BigDecimal.valueOf(lat));
        h.setLongitude(BigDecimal.valueOf(lng));
        return h;
    }

    private Inventory inv(long id, Hospital h, ResourceType t, int total, int available) {
        Inventory i = new Inventory(h, t, total, available);
        i.setId(id);
        return i;
    }

    private EmergencyRequest request(Severity s, Instant at) {
        EmergencyRequest r = new EmergencyRequest();
        r.setId(nextId++);
        r.setPatientName("Test " + s);
        r.setSeverity(s);
        r.setResourceType(ResourceType.ICU);
        r.setLatitude(BigDecimal.valueOf(13.0418));   // T. Nagar
        r.setLongitude(BigDecimal.valueOf(80.2341));
        r.setStatus(RequestStatus.PENDING);
        r.setCreatedAt(at);
        return r;
    }

    @Test
    @DisplayName("Nearest hospital with a free unit of the type is chosen and reduced by one")
    void picksNearestAvailable() {
        Inventory k = inv(10, kauvery, ResourceType.ICU, 18, 1);
        Inventory a = inv(11, apollo, ResourceType.ICU, 30, 5);
        Inventory s = inv(12, srmc, ResourceType.ICU, 28, 6);
        EmergencyRequest r = request(Severity.CRITICAL, Instant.now());

        assertThat(engine.tryAllocate(r, List.of(s, a, k))).isTrue();

        assertThat(r.getStatus()).isEqualTo(RequestStatus.ALLOCATED);
        assertThat(r.getAllocatedHospital()).isSameAs(kauvery);
        assertThat(r.getAllocatedDistanceKm().doubleValue()).isBetween(2.0, 2.5);
        assertThat(k.getAvailable()).isZero();
        assertThat(a.getAvailable()).isEqualTo(5);
        verify(activityService).record(eq(ActivityType.ALLOCATED), anyString(), eq(r.getId()));
        verify(changes).request("ALLOCATED", r.getId());
    }

    @Test
    @DisplayName("A closer hospital without free units is skipped")
    void skipsHospitalWithoutStock() {
        Inventory k = inv(10, kauvery, ResourceType.ICU, 18, 0);
        Inventory a = inv(11, apollo, ResourceType.ICU, 30, 5);
        EmergencyRequest r = request(Severity.CRITICAL, Instant.now());

        assertThat(engine.tryAllocate(r, List.of(k, a))).isTrue();
        assertThat(r.getAllocatedHospital()).isSameAs(apollo);
    }

    @Test
    @DisplayName("No free unit anywhere: request stays PENDING and nothing is published")
    void noCapacityLeavesPending() {
        Inventory k = inv(10, kauvery, ResourceType.ICU, 18, 0);
        EmergencyRequest r = request(Severity.CRITICAL, Instant.now());

        assertThat(engine.tryAllocate(r, List.of(k))).isFalse();
        assertThat(r.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(r.getAllocatedHospital()).isNull();
        verifyNoInteractions(changes);
    }

    @Test
    @DisplayName("Rows of another resource type are never used")
    void ignoresOtherTypes() {
        Inventory vent = inv(10, kauvery, ResourceType.VENTILATOR, 8, 3);
        EmergencyRequest r = request(Severity.CRITICAL, Instant.now());
        assertThat(engine.tryAllocate(r, List.of(vent))).isFalse();
        assertThat(vent.getAvailable()).isEqualTo(3);
    }

    @Test
    @DisplayName("Queue order: CRITICAL > SERIOUS > STABLE, first-come-first-served within a severity")
    void dispatchFollowsPriority() {
        Instant t0 = Instant.parse("2026-11-17T10:00:00Z");
        EmergencyRequest stable = request(Severity.STABLE, t0);                     // 10:00
        EmergencyRequest serious = request(Severity.SERIOUS, t0.plusSeconds(120));  // 10:02
        EmergencyRequest critical = request(Severity.CRITICAL, t0.plusSeconds(300)); // 10:05
        EmergencyRequest critical2 = request(Severity.CRITICAL, t0.plusSeconds(400)); // 10:06:40
        when(requestRepository.lockPendingByType(ResourceType.ICU))
                .thenReturn(new ArrayList<>(List.of(stable, critical2, serious, critical)));
        Inventory k = inv(10, kauvery, ResourceType.ICU, 18, 2);

        List<EmergencyRequest> allocated = engine.dispatchQueue(ResourceType.ICU, List.of(k));

        assertThat(allocated).containsExactly(critical, critical2);
        assertThat(serious.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(stable.getStatus()).isEqualTo(RequestStatus.PENDING);
        assertThat(k.getAvailable()).isZero();
    }

    @Test
    @DisplayName("Report example ordering B (CRITICAL 10:05), C (SERIOUS 10:02), A (STABLE 10:00)")
    void priorityComparator() {
        Instant t0 = Instant.parse("2026-11-17T10:00:00Z");
        EmergencyRequest a = request(Severity.STABLE, t0);
        EmergencyRequest c = request(Severity.SERIOUS, t0.plusSeconds(120));
        EmergencyRequest b = request(Severity.CRITICAL, t0.plusSeconds(300));
        List<EmergencyRequest> list = new ArrayList<>(List.of(a, b, c));
        list.sort(AllocationEngine.PRIORITY);
        assertThat(list).containsExactly(b, c, a);
    }

    @Test
    @DisplayName("Dispatch with no capacity allocates nobody and writes nothing")
    void dispatchWithoutCapacity() {
        when(requestRepository.lockPendingByType(ResourceType.ICU))
                .thenReturn(new ArrayList<>(List.of(request(Severity.CRITICAL, Instant.now()))));
        Inventory k = inv(10, kauvery, ResourceType.ICU, 18, 0);
        assertThat(engine.dispatchQueue(ResourceType.ICU, List.of(k))).isEmpty();
        verify(activityService, never()).record(any(), anyString(), anyLong());
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}
