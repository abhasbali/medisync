package com.medisync.live.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.medisync.live.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithAnonymousUser;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end JWT authentication and role / hospital scoping, with real tokens (no mock user). */
@WithAnonymousUser
class AuthIT extends AbstractIntegrationTest {

    @Autowired
    PasswordEncoder encoder;

    long apollo;
    long fortis;

    @BeforeEach
    void users() {
        apollo = jdbc.queryForObject("SELECT MIN(id) FROM hospitals", Long.class);
        fortis = jdbc.queryForObject("SELECT MAX(id) FROM hospitals", Long.class);
        String hash = encoder.encode("Passw0rd!");
        jdbc.update("INSERT INTO app_users (username, password_hash, full_name, role, hospital_id) VALUES (?,?,?,?,?)",
                "boss", hash, "Boss", "ADMIN", null);
        jdbc.update("INSERT INTO app_users (username, password_hash, full_name, role, hospital_id) VALUES (?,?,?,?,?)",
                "disp", hash, "Disp", "DISPATCHER", null);
        jdbc.update("INSERT INTO app_users (username, password_hash, full_name, role, hospital_id) VALUES (?,?,?,?,?)",
                "nurse", hash, "Nurse", "HOSPITAL_STAFF", apollo);
    }

    private String login(String user) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("username", user, "password", "Passw0rd!"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode n = objectMapper.readTree(body);
        return "Bearer " + n.get("token").asText();
    }

    private long inventoryOf(long hospitalId) {
        return jdbc.queryForObject("SELECT MIN(id) FROM inventory WHERE hospital_id = ?", Long.class, hospitalId);
    }

    @Test
    @DisplayName("Unauthenticated API calls get 401; health and login stay public")
    void anonymous() throws Exception {
        mockMvc.perform(get("/api/hospitals")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("username", "boss", "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    @DisplayName("A valid token reads data and /me returns the user")
    void loginAndMe() throws Exception {
        String t = login("disp");
        mockMvc.perform(get("/api/hospitals").header("Authorization", t)).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").header("Authorization", t))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("DISPATCHER"));
        mockMvc.perform(get("/api/hospitals").header("Authorization", "Bearer garbage"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Dispatchers cannot edit inventory or manage users")
    void dispatcherLimits() throws Exception {
        String t = login("disp");
        mockMvc.perform(patch("/api/inventory/" + inventoryOf(apollo)).header("Authorization", t)
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("total", 10, "available", 5))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/users").header("Authorization", t)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Hospital staff can edit only their own hospital's inventory")
    void staffScope() throws Exception {
        String t = login("nurse");
        long own = inventoryOf(apollo);
        int occupied = jdbc.queryForObject("SELECT total - available FROM inventory WHERE id = ?", Integer.class, own);
        mockMvc.perform(patch("/api/inventory/" + own).header("Authorization", t)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("total", occupied + 50, "available", 50))))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/inventory/" + inventoryOf(fortis)).header("Authorization", t)
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("total", 10, "available", 5))))
                .andExpect(status().isForbidden());
        String actor = jdbc.queryForObject(
                "SELECT actor FROM activity_log WHERE action_type = 'INVENTORY_UPDATED' ORDER BY id DESC LIMIT 1", String.class);
        org.assertj.core.api.Assertions.assertThat(actor).isEqualTo("nurse");
    }

    @Test
    @DisplayName("Disabling a user revokes their existing token")
    void disableRevokes() throws Exception {
        String admin = login("boss");
        String nurse = login("nurse");
        long nurseId = jdbc.queryForObject("SELECT id FROM app_users WHERE username = 'nurse'", Long.class);
        mockMvc.perform(put("/api/users/" + nurseId).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("fullName", "Nurse", "role", "HOSPITAL_STAFF", "hospitalId", apollo, "enabled", false))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/hospitals").header("Authorization", nurse)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Five failed logins lock the account temporarily")
    void lockout() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("username", "disp-lock", "password", "nope"))));
        }
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("username", "disp-lock", "password", "nope"))))
                .andExpect(status().isTooManyRequests());
    }
}
