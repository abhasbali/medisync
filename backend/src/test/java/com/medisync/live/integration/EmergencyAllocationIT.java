package com.medisync.live.integration;

import com.medisync.live.dto.AllocationResultDto;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.support.AbstractIntegrationTest;
import com.medisync.live.support.TestRequests;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static com.medisync.live.support.Areas.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sprint 2: TC 2.1 - TC 2.5, TC 2.7 and the queue rules. TC 2.6 is in ConcurrencyIT. */
class EmergencyAllocationIT extends AbstractIntegrationTest {

    @Autowired
    EmergencyService service;

    private AllocationResultDto create(String name, Severity s, ResourceType t, double[] where) {
        return service.create(TestRequests.patient(name, s, t, where));
    }

    @Test
    @DisplayName("TC 2.1: critical ICU request from T. Nagar goes to the nearest hospital with a free ICU bed")
    void nearestHospitalSelectedAndCountReduced() throws Exception {
        String body = json(Map.of("patientName", "Test Patient Ravi", "patientAge", 58,
                "patientCondition", "Synthetic cardiac case", "severity", "CRITICAL",
                "resourceType", "ICU", "latitude", T_NAGAR[0], "longitude", T_NAGAR[1]));
        mockMvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.allocated").value(true))
                .andExpect(jsonPath("$.request.status").value("ALLOCATED"))
                .andExpect(jsonPath("$.request.hospitalName").value("Kauvery Hospital"));
        assertThat(available("Kauvery Hospital", "ICU")).isZero();
    }

    @ParameterizedTest(name = "{0} {1} -> {2}")
    @DisplayName("Report Table 3.2: illustrative allocations on the sample dataset")
    @CsvSource({
            "T_NAGAR,    ICU,        Kauvery Hospital,               2.3",
            "ANNA_NAGAR, VENTILATOR, Apollo Hospitals,               5.1",
            "TAMBARAM,   GENERAL,    Sri Ramachandra Medical Centre, 13.4",
            "PERAMBUR,   EMERGENCY,  Government General Hospital,    6.2",
            "PORUR,      OXYGEN,     Sri Ramachandra Medical Centre, 1.3"
    })
    void table32Allocations(String area, ResourceType type, String expectedHospital, double km) {
        double[] where = switch (area) {
            case "T_NAGAR" -> T_NAGAR;
            case "ANNA_NAGAR" -> ANNA_NAGAR;
            case "TAMBARAM" -> TAMBARAM;
            case "PERAMBUR" -> PERAMBUR;
            default -> PORUR;
        };
        AllocationResultDto r = create("Test Patient " + area, Severity.SERIOUS, type, where);
        assertThat(r.allocated()).isTrue();
        assertThat(r.request().hospitalName()).isEqualTo(expectedHospital);
        assertThat(r.request().distanceKm()).isCloseTo(km, within(0.15));
    }

    @Test
    @DisplayName("The nearest hospital is skipped when it has no free unit of the type")
    void skipsNearestWithoutStock() {
        setAvailable("Kauvery Hospital", "ICU", 0);
        AllocationResultDto r = create("Test Patient C", Severity.CRITICAL, ResourceType.ICU, T_NAGAR);
        assertThat(r.request().hospitalName()).isEqualTo("Apollo Hospitals");
    }

    @Test
    @DisplayName("TC 2.2: no free bed of the type -> request saved as PENDING and queued")
    void noBedGivesPending() throws Exception {
        exhaust("VENTILATOR");
        AllocationResultDto r = create("Test Patient D", Severity.SERIOUS, ResourceType.VENTILATOR, ANNA_NAGAR);
        assertThat(r.allocated()).isFalse();
        assertThat(r.message()).isEqualTo(EmergencyService.QUEUED_MESSAGE);
        assertThat(r.request().status().name()).isEqualTo("PENDING");
        assertThat(r.request().hospitalId()).isNull();
        assertThat(r.request().queuePosition()).isEqualTo(1);
        mockMvc.perform(get("/api/stats")).andExpect(jsonPath("$.waitingPatients").value(1));
    }

    @Test
    @DisplayName("TC 2.3: discharge releases the bed exactly once")
    void dischargeReleasesBed() throws Exception {
        AllocationResultDto r = create("Test Patient E", Severity.STABLE, ResourceType.ICU, T_NAGAR);
        long id = r.request().id();
        assertThat(available("Kauvery Hospital", "ICU")).isZero();

        mockMvc.perform(post("/api/requests/" + id + "/discharge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISCHARGED"))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(1);

        // Repeating the discharge is rejected and must not add a second unit.
        mockMvc.perform(post("/api/requests/" + id + "/discharge"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("Only ALLOCATED")));
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(1);
        // A discharged request can no longer be cancelled either.
        mockMvc.perform(post("/api/requests/" + id + "/cancel")).andExpect(status().isConflict());
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(1);
    }

    @Test
    @DisplayName("TC 2.4: when a bed frees up the CRITICAL patient receives it before the STABLE one")
    void criticalServedFirst() {
        exhaust("ICU");
        setAvailable("Kauvery Hospital", "ICU", 1);
        long occupant = create("Test Occupant", Severity.SERIOUS, ResourceType.ICU, T_NAGAR).request().id();

        long stable = create("Test Stable", Severity.STABLE, ResourceType.ICU, T_NAGAR).request().id();
        long critical = create("Test Critical", Severity.CRITICAL, ResourceType.ICU, T_NAGAR).request().id();
        assertThat(requestStatus(stable)).isEqualTo("PENDING");
        assertThat(requestStatus(critical)).isEqualTo("PENDING");

        service.discharge(occupant);

        assertThat(requestStatus(critical)).isEqualTo("ALLOCATED");
        assertThat(requestStatus(stable)).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("Report example: STABLE 10:00, CRITICAL 10:05, SERIOUS 10:02 -> CRITICAL, SERIOUS, STABLE")
    void reportQueueExampleOrder() {
        exhaust("ICU");
        long a = create("Test Patient A", Severity.STABLE, ResourceType.ICU, T_NAGAR).request().id();
        long c = create("Test Patient C", Severity.SERIOUS, ResourceType.ICU, T_NAGAR).request().id();
        long b = create("Test Patient B", Severity.CRITICAL, ResourceType.ICU, T_NAGAR).request().id();
        // Force the arrival times of the report example.
        jdbc.update("UPDATE emergency_requests SET created_at = '2026-11-17 10:00:00' WHERE id = ?", a);
        jdbc.update("UPDATE emergency_requests SET created_at = '2026-11-17 10:02:00' WHERE id = ?", c);
        jdbc.update("UPDATE emergency_requests SET created_at = '2026-11-17 10:05:00' WHERE id = ?", b);

        var queue = service.queue();
        assertThat(queue).extracting(q -> q.id()).containsExactly(b, c, a);
        assertThat(queue).extracting(q -> q.queuePosition()).containsExactly(1, 2, 3);

        long kauvery = inventoryId("Kauvery Hospital", "ICU");
        jdbc.update("UPDATE inventory SET available = 0 WHERE id = ?", kauvery);
        // Release beds one at a time through the admin path and watch the order.
        var inv = new com.medisync.live.dto.InventoryUpdateRequest(18, 1);
        inventoryService().update(kauvery, inv);
        assertThat(requestStatus(b)).isEqualTo("ALLOCATED");
        assertThat(requestStatus(c)).isEqualTo("PENDING");
        inventoryService().update(kauvery, new com.medisync.live.dto.InventoryUpdateRequest(18, 1));
        assertThat(requestStatus(c)).isEqualTo("ALLOCATED");
        assertThat(requestStatus(a)).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("Equal severity is served first-come-first-served")
    void equalSeverityFifo() {
        exhaust("GENERAL");
        long first = create("Test First", Severity.SERIOUS, ResourceType.GENERAL, TAMBARAM).request().id();
        long second = create("Test Second", Severity.SERIOUS, ResourceType.GENERAL, TAMBARAM).request().id();
        long id = inventoryId("Fortis Malar Hospital", "GENERAL");
        inventoryService().update(id, new com.medisync.live.dto.InventoryUpdateRequest(90, 1));
        assertThat(requestStatus(first)).isEqualTo("ALLOCATED");
        assertThat(requestStatus(second)).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("A waiting patient only receives a resource of the type they need")
    void onlyMatchingTypeAllocated() {
        exhaust("VENTILATOR");
        long vent = create("Test Vent", Severity.CRITICAL, ResourceType.VENTILATOR, T_NAGAR).request().id();
        long icuOccupant = create("Test ICU", Severity.STABLE, ResourceType.ICU, T_NAGAR).request().id();
        service.discharge(icuOccupant); // frees an ICU bed, not a ventilator
        assertThat(requestStatus(vent)).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("TC 2.5: cancelling a pending request changes no bed count")
    void cancelPendingKeepsInventory() throws Exception {
        exhaust("OXYGEN");
        long id = create("Test Pending", Severity.STABLE, ResourceType.OXYGEN, PORUR).request().id();
        int before = sumAvailable("OXYGEN");
        mockMvc.perform(post("/api/requests/" + id + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(sumAvailable("OXYGEN")).isEqualTo(before);
    }

    @Test
    @DisplayName("Cancelling an allocated request releases the bed and serves the queue")
    void cancelAllocatedReleasesAndDispatches() {
        exhaust("EMERGENCY");
        setAvailable("Government General Hospital", "EMERGENCY", 1);
        long allocated = create("Test Allocated", Severity.SERIOUS, ResourceType.EMERGENCY, PERAMBUR).request().id();
        long waiting = create("Test Waiting", Severity.STABLE, ResourceType.EMERGENCY, PERAMBUR).request().id();
        assertThat(requestStatus(waiting)).isEqualTo("PENDING");

        service.cancel(allocated);

        assertThat(requestStatus(allocated)).isEqualTo("CANCELLED");
        assertThat(requestStatus(waiting)).isEqualTo("ALLOCATED");
        assertThat(available("Government General Hospital", "EMERGENCY")).isZero();
        assertThatThrownBy(() -> service.cancel(allocated)).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("TC 2.7: missing patient name and invalid enum values give clear validation errors")
    void invalidInputRejected() throws Exception {
        String missingName = "{\"patientAge\":30,\"patientCondition\":\"x\",\"severity\":\"CRITICAL\","
                + "\"resourceType\":\"ICU\",\"latitude\":13.04,\"longitude\":80.23}";
        mockMvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content(missingName))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.patientName").value("Patient name is required"));

        String badType = "{\"patientName\":\"Test\",\"patientAge\":30,\"patientCondition\":\"x\",\"severity\":\"CRITICAL\","
                + "\"resourceType\":\"SUITE\",\"latitude\":13.04,\"longitude\":80.23}";
        mockMvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content(badType))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Accepted values")));

        String badLat = "{\"patientName\":\"Test\",\"patientAge\":30,\"patientCondition\":\"x\",\"severity\":\"CRITICAL\","
                + "\"resourceType\":\"ICU\",\"latitude\":95,\"longitude\":80.23}";
        mockMvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content(badLat))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.latitude").exists());

        mockMvc.perform(post("/api/requests/424242/discharge")).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests", Integer.class)).isZero();
    }

    @Autowired
    private com.medisync.live.service.InventoryService inventoryService;

    private com.medisync.live.service.InventoryService inventoryService() {
        return inventoryService;
    }
}
