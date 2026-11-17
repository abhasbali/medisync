package com.medisync.live.integration;

import com.medisync.live.dto.AllocationResultDto;
import com.medisync.live.dto.CreateTransferRequest;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.TransactionRetryExecutor;
import com.medisync.live.service.TransferService;
import com.medisync.live.support.AbstractIntegrationTest;
import com.medisync.live.support.TestRequests;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static com.medisync.live.support.Areas.*;
import static org.assertj.core.api.Assertions.assertThat;

/** TC 2.6 and stress variants: concurrent operations must never double-book or corrupt counts. */
class ConcurrencyIT extends AbstractIntegrationTest {

    @Autowired
    EmergencyService emergencyService;
    @Autowired
    TransferService transferService;
    @Autowired
    TransactionRetryExecutor retry;

    /** Start all tasks at the same instant and collect their results. */
    private <T> List<T> runTogether(List<Supplier<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (Supplier<T> task : tasks) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return retry.execute(task);
            }));
        }
        ready.await();
        go.countDown();
        List<T> out = new ArrayList<>();
        for (Future<T> f : futures) {
            out.add(f.get(60, TimeUnit.SECONDS));
        }
        pool.shutdown();
        return out;
    }

    @Test
    @DisplayName("TC 2.6: two simultaneous requests for the last free bed -> one allocated, one queued")
    void twoRequestsForLastBed() throws Exception {
        exhaust("ICU");
        setAvailable("Kauvery Hospital", "ICU", 1);

        List<AllocationResultDto> results = runTogether(List.of(
                () -> emergencyService.create(TestRequests.patient("Test Concurrent 1", Severity.CRITICAL, ResourceType.ICU, T_NAGAR)),
                () -> emergencyService.create(TestRequests.patient("Test Concurrent 2", Severity.CRITICAL, ResourceType.ICU, ANNA_NAGAR))));

        assertThat(results).filteredOn(AllocationResultDto::allocated).hasSize(1);
        assertThat(results).filteredOn(r -> !r.allocated()).hasSize(1);
        assertThat(available("Kauvery Hospital", "ICU")).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests WHERE status='ALLOCATED'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests WHERE status='PENDING'", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("Twenty simultaneous requests for six free ventilators -> exactly six allocated, none negative")
    void manyRequestsLimitedCapacity() throws Exception {
        exhaust("VENTILATOR");
        setAvailable("Apollo Hospitals", "VENTILATOR", 2);
        setAvailable("MIOT International", "VENTILATOR", 2);
        setAvailable("Government General Hospital", "VENTILATOR", 2);
        double[][] places = {T_NAGAR, ANNA_NAGAR, TAMBARAM, PERAMBUR, PORUR};
        List<Supplier<AllocationResultDto>> tasks = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            int n = i;
            tasks.add(() -> emergencyService.create(TestRequests.patient("Test Load " + n,
                    Severity.values()[n % 3], ResourceType.VENTILATOR, places[n % places.length])));
        }
        List<AllocationResultDto> results = runTogether(tasks);

        assertThat(results).filteredOn(AllocationResultDto::allocated).hasSize(6);
        assertThat(sumAvailable("VENTILATOR")).isZero();
        assertThat(jdbc.queryForObject("SELECT MIN(available) FROM inventory", Integer.class)).isGreaterThanOrEqualTo(0);
        // Every allocated patient maps to a distinct reserved unit: per hospital, allocations == units taken.
        for (String h : List.of("Apollo Hospitals", "MIOT International", "Government General Hospital")) {
            Integer allocated = jdbc.queryForObject("SELECT COUNT(*) FROM emergency_requests r JOIN hospitals h "
                    + "ON h.id = r.allocated_hospital_id WHERE h.name = ? AND r.status = 'ALLOCATED'", Integer.class, h);
            assertThat(allocated).as(h).isEqualTo(2);
        }
    }

    @Test
    @DisplayName("Concurrent duplicate discharges increase inventory only once")
    void concurrentDischargeOnlyOnce() throws Exception {
        long id = emergencyService.create(TestRequests.patient("Test Discharge", Severity.SERIOUS, ResourceType.ICU, T_NAGAR))
                .request().id();
        int before = available("Kauvery Hospital", "ICU");
        List<Supplier<String>> tasks = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            tasks.add(() -> {
                try {
                    emergencyService.discharge(id);
                    return "ok";
                } catch (com.medisync.live.exception.ConflictException e) {
                    return "conflict";
                }
            });
        }
        List<String> results = runTogether(tasks);
        assertThat(results).filteredOn("ok"::equals).hasSize(1);
        assertThat(available("Kauvery Hospital", "ICU")).isEqualTo(before + 1);
    }

    @Test
    @DisplayName("A transfer can never be approved twice, even when approvals race")
    void concurrentApprovalOnlyOnce() throws Exception {
        long apollo = hospitalId("Apollo Hospitals");
        long miot = hospitalId("MIOT International");
        long transferId = transferService.create(new CreateTransferRequest(miot, apollo, ResourceType.ICU, 2, "Test surge"))
                .id();
        List<Supplier<String>> tasks = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            tasks.add(() -> {
                try {
                    transferService.approve(transferId);
                    return "ok";
                } catch (com.medisync.live.exception.ConflictException e) {
                    return "conflict";
                }
            });
        }
        List<String> results = runTogether(tasks);
        assertThat(results).filteredOn("ok"::equals).hasSize(1);
        assertThat(total("Apollo Hospitals", "ICU")).isEqualTo(28);
        assertThat(total("MIOT International", "ICU")).isEqualTo(27);
    }
}
