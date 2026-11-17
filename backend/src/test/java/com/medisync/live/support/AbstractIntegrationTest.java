package com.medisync.live.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.MySQLContainer;

import static org.mockito.Mockito.clearInvocations;

/**
 * Base class for MySQL-backed integration tests.
 * <p>
 * Database selection:
 * <ol>
 *   <li>If TEST_DB_URL is set, that MySQL database is used (TEST_DB_USERNAME / TEST_DB_PASSWORD).</li>
 *   <li>Otherwise, if Docker is available, a disposable MySQL 8 Testcontainer is started.</li>
 *   <li>Otherwise the local server at localhost:3306/medisync_test is used with DB_USERNAME / DB_PASSWORD.</li>
 * </ol>
 * Before every test the schema is rebuilt with Flyway (clean + migrate), so each test starts from the
 * report's seed data: 6 hospitals, 30 inventory rows, 444 available of 1460.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    private static MySQLContainer<?> container;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String url = System.getenv("TEST_DB_URL");
        if (url != null && !url.isBlank()) {
            registry.add("spring.datasource.url", () -> url);
            registry.add("spring.datasource.username", () -> env("TEST_DB_USERNAME", env("DB_USERNAME", "medisync")));
            registry.add("spring.datasource.password", () -> env("TEST_DB_PASSWORD", env("DB_PASSWORD", "medisync")));
        } else if (dockerAvailable()) {
            if (container == null) {
                container = new MySQLContainer<>("mysql:8.0.36").withDatabaseName("medisync_test");
                container.start();
            }
            registry.add("spring.datasource.url", container::getJdbcUrl);
            registry.add("spring.datasource.username", container::getUsername);
            registry.add("spring.datasource.password", container::getPassword);
        } else {
            registry.add("spring.datasource.url", () -> "jdbc:mysql://localhost:3306/medisync_test"
                    + "?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true");
            registry.add("spring.datasource.username", () -> env("DB_USERNAME", "medisync"));
            registry.add("spring.datasource.password", () -> env("DB_PASSWORD", "medisync"));
        }
        registry.add("spring.flyway.clean-disabled", () -> "false");
    }

    private static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable t) {
            return false;
        }
    }

    private static String env(String name, String fallback) {
        String v = System.getenv(name);
        return v == null ? fallback : v;
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    private Flyway flyway;

    /** Spy on the real broker template so tests can assert what was (and was not) broadcast. */
    @SpyBean
    protected SimpMessagingTemplate messagingTemplate;

    @BeforeEach
    void resetDatabase() {
        flyway.clean();
        flyway.migrate();
        clearInvocations(messagingTemplate);
    }

    // ---- helpers -------------------------------------------------------------------------------

    protected long hospitalId(String name) {
        return jdbc.queryForObject("SELECT id FROM hospitals WHERE name = ?", Long.class, name);
    }

    protected int available(String hospital, String type) {
        return jdbc.queryForObject("SELECT i.available FROM inventory i JOIN hospitals h ON h.id = i.hospital_id "
                + "WHERE h.name = ? AND i.resource_type = ?", Integer.class, hospital, type);
    }

    protected int total(String hospital, String type) {
        return jdbc.queryForObject("SELECT i.total FROM inventory i JOIN hospitals h ON h.id = i.hospital_id "
                + "WHERE h.name = ? AND i.resource_type = ?", Integer.class, hospital, type);
    }

    protected long inventoryId(String hospital, String type) {
        return jdbc.queryForObject("SELECT i.id FROM inventory i JOIN hospitals h ON h.id = i.hospital_id "
                + "WHERE h.name = ? AND i.resource_type = ?", Long.class, hospital, type);
    }

    protected void setAvailable(String hospital, String type, int available) {
        jdbc.update("UPDATE inventory i JOIN hospitals h ON h.id = i.hospital_id SET i.available = ? "
                + "WHERE h.name = ? AND i.resource_type = ?", available, hospital, type);
    }

    /** Make every row of a type fully occupied (available = 0). */
    protected void exhaust(String type) {
        jdbc.update("UPDATE inventory SET available = 0 WHERE resource_type = ?", type);
    }

    protected int sumAvailable(String type) {
        return jdbc.queryForObject("SELECT SUM(available) FROM inventory WHERE resource_type = ?", Integer.class, type);
    }

    protected String requestStatus(long requestId) {
        return jdbc.queryForObject("SELECT status FROM emergency_requests WHERE id = ?", String.class, requestId);
    }

    protected String json(Object o) throws Exception {
        return objectMapper.writeValueAsString(o);
    }
}
