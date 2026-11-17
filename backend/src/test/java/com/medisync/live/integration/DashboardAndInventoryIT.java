package com.medisync.live.integration;

import com.medisync.live.dto.InventoryUpdateRequest;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.InventoryService;
import com.medisync.live.support.AbstractIntegrationTest;
import com.medisync.live.support.Areas;
import com.medisync.live.support.TestRequests;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sprint 1: TC 1.1 - TC 1.6 plus inventory validation and consistency rules. */
class DashboardAndInventoryIT extends AbstractIntegrationTest {

    @Autowired
    InventoryService inventoryService;
    @Autowired
    EmergencyService emergencyService;

    @Test
    @DisplayName("TC 1.1: dashboard returns all six hospitals with all five resource types")
    void dashboardListsAllHospitalsAndResources() throws Exception {
        mockMvc.perform(get("/api/hospitals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[*].inventory", everyItem(hasSize(5))))
                .andExpect(jsonPath("$[0].name").value("Apollo Hospitals"))
                .andExpect(jsonPath("$[0].phone").value("044-28290200"))
                .andExpect(jsonPath("$[0].inventory[*].resourceType",
                        contains("EMERGENCY", "ICU", "VENTILATOR", "GENERAL", "OXYGEN")));
        mockMvc.perform(get("/api/inventory")).andExpect(jsonPath("$", hasSize(30)));
    }

    @Test
    @DisplayName("TC 1.6: summary cards match the database (444 available of 1460)")
    void statsMatchDatabaseTotals() throws Exception {
        mockMvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAvailable").value(444))
                .andExpect(jsonPath("$.totalCapacity").value(1460))
                .andExpect(jsonPath("$.activeAdmissions").value(0))
                .andExpect(jsonPath("$.waitingPatients").value(0))
                .andExpect(jsonPath("$.hospitalCount").value(6))
                .andExpect(jsonPath("$.byResource", hasSize(5)));
    }

    @Test
    @DisplayName("TC 1.2 + TC 1.5: capacity change persists and is written to the activity log")
    void inventoryUpdatePersistsAndIsLogged() throws Exception {
        long id = inventoryId("Apollo Hospitals", "ICU");
        mockMvc.perform(patch("/api/inventory/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("total", 30, "available", 3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(3))
                .andExpect(jsonPath("$.total").value(30));
        assertThat(available("Apollo Hospitals", "ICU")).isEqualTo(3);
        mockMvc.perform(get("/api/activity"))
                .andExpect(jsonPath("$[0].actionType").value("INVENTORY_UPDATED"))
                .andExpect(jsonPath("$[0].message", containsString("Apollo Hospitals updated ICU")));
    }

    @Test
    @DisplayName("TC 1.3: available greater than total is rejected and nothing is saved")
    void availableAboveTotalRejected() throws Exception {
        long id = inventoryId("Apollo Hospitals", "ICU");
        mockMvc.perform(patch("/api/inventory/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("total", 10, "available", 11))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("cannot exceed total")));
        assertThat(available("Apollo Hospitals", "ICU")).isEqualTo(5);
        assertThat(total("Apollo Hospitals", "ICU")).isEqualTo(30);
    }

    @Test
    @DisplayName("Negative and non-integer counts are rejected with field errors")
    void invalidCountsRejected() throws Exception {
        long id = inventoryId("Apollo Hospitals", "ICU");
        mockMvc.perform(patch("/api/inventory/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"total\": -1, \"available\": 0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.total").value("Total must be zero or more"));
        mockMvc.perform(patch("/api/inventory/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"total\": 10.5, \"available\": 2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.total", containsString("whole number")));
        mockMvc.perform(patch("/api/inventory/999999").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"total\": 1, \"available\": 1}"))
                .andExpect(status().isNotFound());
        assertThat(total("Apollo Hospitals", "ICU")).isEqualTo(30);
    }

    @Test
    @DisplayName("An edit cannot make occupied units fewer than active allocations")
    void editCannotInvalidateActiveReservations() {
        exhaust("VENTILATOR");
        setAvailable("Kauvery Hospital", "VENTILATOR", 1);
        emergencyService.create(TestRequests.patient("Test Patient A", Severity.CRITICAL, ResourceType.VENTILATOR, Areas.T_NAGAR));
        long id = inventoryId("Kauvery Hospital", "VENTILATOR"); // now total 8, available 0, 1 active allocation

        // Setting available == total would leave zero occupied units for one allocated patient.
        org.junit.jupiter.api.Assertions.assertThrows(com.medisync.live.exception.ConflictException.class,
                () -> inventoryService.update(id, new InventoryUpdateRequest(8, 8)));
        assertThat(available("Kauvery Hospital", "VENTILATOR")).isZero();

        // Keeping at least one occupied unit is fine.
        inventoryService.update(id, new InventoryUpdateRequest(8, 7));
        assertThat(available("Kauvery Hospital", "VENTILATOR")).isEqualTo(7);
    }

    @Test
    @DisplayName("Adding capacity automatically serves the waiting queue")
    void capacityIncreaseDispatchesQueue() {
        exhaust("OXYGEN");
        var queued = emergencyService.create(TestRequests.patient("Test Patient B", Severity.SERIOUS, ResourceType.OXYGEN, Areas.PORUR));
        assertThat(queued.allocated()).isFalse();

        long id = inventoryId("MIOT International", "OXYGEN");
        inventoryService.update(id, new InventoryUpdateRequest(40, 1));

        assertThat(requestStatus(queued.request().id())).isEqualTo("ALLOCATED");
        assertThat(available("MIOT International", "OXYGEN")).isZero();
    }
}
