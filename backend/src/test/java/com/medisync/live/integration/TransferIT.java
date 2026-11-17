package com.medisync.live.integration;

import com.medisync.live.dto.CreateTransferRequest;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.TransferService;
import com.medisync.live.support.AbstractIntegrationTest;
import com.medisync.live.support.TestRequests;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static com.medisync.live.support.Areas.T_NAGAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sprint 3: TC 3.1 - TC 3.6 plus duplicate resolution and queue dispatch after approval. */
class TransferIT extends AbstractIntegrationTest {

    @Autowired
    TransferService transferService;
    @Autowired
    EmergencyService emergencyService;

    private long create(String requester, String donor, ResourceType type, int qty) {
        return transferService.create(new CreateTransferRequest(hospitalId(requester), hospitalId(donor), type, qty, "Test"))
                .id();
    }

    @Test
    @DisplayName("TC 3.1: MIOT asks Apollo for 2 ICU beds -> saved as PENDING and listed")
    void createTransfer() throws Exception {
        String body = json(Map.of("requesterHospitalId", hospitalId("MIOT International"),
                "donorHospitalId", hospitalId("Apollo Hospitals"), "resourceType", "ICU", "quantity", 2,
                "note", "Synthetic surge"));
        mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.requesterHospitalName").value("MIOT International"))
                .andExpect(jsonPath("$.donorHospitalName").value("Apollo Hospitals"));
        mockMvc.perform(get("/api/transfers")).andExpect(jsonPath("$[0].status").value("PENDING"));
        assertThat(total("Apollo Hospitals", "ICU")).isEqualTo(30);
    }

    @Test
    @DisplayName("TC 3.2: approval reduces the donor by 2 and increases the requester by 2 (totals and available)")
    void approveMovesCapacity() throws Exception {
        long id = create("MIOT International", "Apollo Hospitals", ResourceType.ICU, 2);
        mockMvc.perform(post("/api/transfers/" + id + "/approve"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.resolvedAt").isNotEmpty());
        assertThat(total("Apollo Hospitals", "ICU")).isEqualTo(28);
        assertThat(available("Apollo Hospitals", "ICU")).isEqualTo(3);
        assertThat(total("MIOT International", "ICU")).isEqualTo(27);
        assertThat(available("MIOT International", "ICU")).isEqualTo(4);
        // System-wide capacity is conserved.
        assertThat(jdbc.queryForObject("SELECT SUM(total) FROM inventory", Integer.class)).isEqualTo(1460);
    }

    @Test
    @DisplayName("Report example: B has 10 total / 4 available, A asks for 2 -> B 8/2, A +2/+2")
    void reportTransferExample() {
        jdbc.update("UPDATE inventory i JOIN hospitals h ON h.id = i.hospital_id SET i.total = 10, i.available = 4 "
                + "WHERE h.name = 'Fortis Malar Hospital' AND i.resource_type = 'ICU'");
        int aTotal = total("Kauvery Hospital", "ICU");
        int aAvail = available("Kauvery Hospital", "ICU");
        transferService.approve(create("Kauvery Hospital", "Fortis Malar Hospital", ResourceType.ICU, 2));
        assertThat(total("Fortis Malar Hospital", "ICU")).isEqualTo(8);
        assertThat(available("Fortis Malar Hospital", "ICU")).isEqualTo(2);
        assertThat(total("Kauvery Hospital", "ICU")).isEqualTo(aTotal + 2);
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(aAvail + 2);
    }

    @Test
    @DisplayName("TC 3.3: insufficient donor stock -> error, request stays PENDING, counts unchanged")
    void insufficientStockBlocksApproval() throws Exception {
        long id = create("Fortis Malar Hospital", "Government General Hospital", ResourceType.VENTILATOR, 7);
        mockMvc.perform(post("/api/transfers/" + id + "/approve"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("Donor does not have enough available units")));
        assertThat(jdbc.queryForObject("SELECT status FROM transfer_requests WHERE id = ?", String.class, id)).isEqualTo("PENDING");
        assertThat(total("Government General Hospital", "VENTILATOR")).isEqualTo(20);
        assertThat(available("Government General Hospital", "VENTILATOR")).isEqualTo(5);
        assertThat(total("Fortis Malar Hospital", "VENTILATOR")).isEqualTo(10);
        assertThat(available("Fortis Malar Hospital", "VENTILATOR")).isEqualTo(2);
    }

    @Test
    @DisplayName("TC 3.4: rejection changes only the status; repeated decisions are refused")
    void rejectKeepsInventory() throws Exception {
        long id = create("Fortis Malar Hospital", "Government General Hospital", ResourceType.VENTILATOR, 1);
        mockMvc.perform(post("/api/transfers/" + id + "/reject"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(total("Government General Hospital", "VENTILATOR")).isEqualTo(20);
        assertThat(total("Fortis Malar Hospital", "VENTILATOR")).isEqualTo(10);

        mockMvc.perform(post("/api/transfers/" + id + "/approve"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already been REJECTED")));
        mockMvc.perform(post("/api/transfers/" + id + "/reject")).andExpect(status().isConflict());
        assertThat(total("Fortis Malar Hospital", "VENTILATOR")).isEqualTo(10);
    }

    @Test
    @DisplayName("A transfer cannot be approved twice")
    void duplicateApprovalRefused() throws Exception {
        long id = create("MIOT International", "Apollo Hospitals", ResourceType.GENERAL, 5);
        mockMvc.perform(post("/api/transfers/" + id + "/approve")).andExpect(status().isOk());
        mockMvc.perform(post("/api/transfers/" + id + "/approve"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already been APPROVED")));
        assertThat(total("Apollo Hospitals", "GENERAL")).isEqualTo(115);
        assertThat(total("MIOT International", "GENERAL")).isEqualTo(105);
    }

    @Test
    @DisplayName("TC 3.5 + TC 3.6: same hospital, zero, negative, fractional and invalid type are rejected")
    void validationRules() throws Exception {
        long apollo = hospitalId("Apollo Hospitals");
        long miot = hospitalId("MIOT International");
        mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("requesterHospitalId", apollo, "donorHospitalId", apollo,
                                "resourceType", "ICU", "quantity", 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("must be different")));
        for (String qty : new String[]{"0", "-1"}) {
            mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"requesterHospitalId\":" + miot + ",\"donorHospitalId\":" + apollo
                                    + ",\"resourceType\":\"ICU\",\"quantity\":" + qty + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.quantity", containsString("at least 1")));
        }
        mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requesterHospitalId\":" + miot + ",\"donorHospitalId\":" + apollo
                                + ",\"resourceType\":\"ICU\",\"quantity\":2.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.quantity", containsString("whole number")));
        mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requesterHospitalId\":" + miot + ",\"donorHospitalId\":" + apollo
                                + ",\"resourceType\":\"HELICOPTER\",\"quantity\":1}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requesterHospitalId\":" + miot + ",\"donorHospitalId\":99999"
                                + ",\"resourceType\":\"ICU\",\"quantity\":1}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/transfers/99999/approve")).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM transfer_requests", Integer.class)).isZero();
    }

    @Test
    @DisplayName("Approval creates a missing requester inventory row safely")
    void approvalCreatesMissingRequesterRow() {
        jdbc.update("DELETE i FROM inventory i JOIN hospitals h ON h.id = i.hospital_id "
                + "WHERE h.name = 'Kauvery Hospital' AND i.resource_type = 'OXYGEN'");
        transferService.approve(create("Kauvery Hospital", "Apollo Hospitals", ResourceType.OXYGEN, 3));
        assertThat(total("Kauvery Hospital", "OXYGEN")).isEqualTo(3);
        assertThat(available("Kauvery Hospital", "OXYGEN")).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory i JOIN hospitals h ON h.id = i.hospital_id "
                + "WHERE h.name = 'Kauvery Hospital' AND i.resource_type = 'OXYGEN'", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("Approved capacity is offered to waiting patients immediately")
    void approvalDispatchesQueue() {
        jdbc.update("UPDATE inventory i JOIN hospitals h ON h.id = i.hospital_id SET i.available = 0 "
                + "WHERE i.resource_type = 'VENTILATOR' AND h.name <> 'Government General Hospital'");
        // GGH keeps its 5 free ventilators but nobody else has any.
        jdbc.update("UPDATE inventory i JOIN hospitals h ON h.id = i.hospital_id SET i.available = 0 "
                + "WHERE i.resource_type = 'VENTILATOR' AND h.name = 'Government General Hospital'");
        long waiting = emergencyService.create(TestRequests.patient("Test Waiting", Severity.CRITICAL,
                ResourceType.VENTILATOR, T_NAGAR)).request().id();
        assertThat(requestStatus(waiting)).isEqualTo("PENDING");

        jdbc.update("UPDATE inventory i JOIN hospitals h ON h.id = i.hospital_id SET i.available = 5 "
                + "WHERE i.resource_type = 'VENTILATOR' AND h.name = 'Government General Hospital'");
        transferService.approve(create("Kauvery Hospital", "Government General Hospital", ResourceType.VENTILATOR, 1));

        assertThat(requestStatus(waiting)).isEqualTo("ALLOCATED");
    }
}
