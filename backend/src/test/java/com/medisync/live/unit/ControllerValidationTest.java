package com.medisync.live.unit;

import com.medisync.live.controller.EmergencyController;
import com.medisync.live.controller.TransferController;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.TransactionRetryExecutor;
import com.medisync.live.service.TransferService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bean Validation and error mapping, without a database. Invalid input never reaches the service. */
@WebMvcTest(controllers = {EmergencyController.class, TransferController.class})
@Import(TransactionRetryExecutor.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
class ControllerValidationTest {

    @Autowired
    MockMvc mvc;
    @MockBean
    EmergencyService emergencyService;
    @MockBean
    TransferService transferService;
    @MockBean
    com.medisync.live.security.AccessGuard accessGuard;

    @Test
    @DisplayName("Missing required emergency fields return 400 with one message per field")
    void emergencyMissingFields() throws Exception {
        mvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors.patientName").value("Patient name is required"))
                .andExpect(jsonPath("$.fieldErrors.severity").value("Severity is required"))
                .andExpect(jsonPath("$.fieldErrors.resourceType").value("Resource type is required"))
                .andExpect(jsonPath("$.fieldErrors.latitude").value("Latitude is required"));
        verifyNoInteractions(emergencyService);
    }

    @Test
    @DisplayName("Out-of-range age and malformed JSON are rejected")
    void emergencyBadValues() throws Exception {
        String body = "{\"patientName\":\"Test\",\"patientAge\":200,\"patientCondition\":\"x\",\"severity\":\"CRITICAL\","
                + "\"resourceType\":\"ICU\",\"latitude\":13,\"longitude\":80}";
        mvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.patientAge", containsString("between 0 and 130")));
        mvc.perform(post("/api/requests").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed JSON request body"));
        verifyNoInteractions(emergencyService);
    }

    @Test
    @DisplayName("Fractional transfer quantity is rejected instead of being truncated")
    void transferFractionalQuantity() throws Exception {
        mvc.perform(post("/api/transfers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requesterHospitalId\":1,\"donorHospitalId\":2,\"resourceType\":\"ICU\",\"quantity\":1.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.quantity", containsString("whole number")));
        verifyNoInteractions(transferService);
    }

    @Test
    @DisplayName("Business rule violations map to 409 Conflict with the service message")
    void conflictMapping() throws Exception {
        when(transferService.approve(7L)).thenThrow(new ConflictException("Transfer request #7 has already been APPROVED"));
        mvc.perform(post("/api/transfers/7/approve"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Transfer request #7 has already been APPROVED"));
    }

    @Test
    @DisplayName("Non-numeric path ids return 400")
    void badPathId() throws Exception {
        mvc.perform(post("/api/requests/abc/discharge"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("abc")));
        verify(emergencyService, never()).discharge(any());
    }
}
