package com.medisync.live.unit;

import com.medisync.live.entity.Hospital;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.service.GeoUtils;
import com.medisync.live.service.TransactionRetryExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

class DomainRulesTest {

    private static Inventory inv(int total, int available) {
        Hospital h = new Hospital();
        h.setName("Test Hospital");
        return new Inventory(h, ResourceType.ICU, total, available);
    }

    @Test
    @DisplayName("Haversine: Chennai T. Nagar to Kauvery Alwarpet is about 2.3 km; same point is 0")
    void haversine() {
        assertThat(GeoUtils.haversineKm(13.0418, 80.2341, 13.0336, 80.2535)).isCloseTo(2.29, within(0.05));
        assertThat(GeoUtils.haversineKm(13.0, 80.0, 13.0, 80.0)).isZero();
        // One degree of latitude is ~111.2 km.
        assertThat(GeoUtils.haversineKm(0, 0, 1, 0)).isCloseTo(111.19, within(0.1));
    }

    @Test
    @DisplayName("Guarded decrement never goes below zero")
    void reserveGuard() {
        Inventory i = inv(2, 1);
        assertThat(i.tryReserveOne()).isTrue();
        assertThat(i.tryReserveOne()).isFalse();
        assertThat(i.getAvailable()).isZero();
    }

    @Test
    @DisplayName("Release never exceeds total")
    void releaseGuard() {
        Inventory i = inv(2, 2);
        assertThatThrownBy(i::releaseOne).isInstanceOf(ConflictException.class);
        assertThat(i.getAvailable()).isEqualTo(2);
    }

    @Test
    @DisplayName("Transfers move total and available together and refuse insufficient stock")
    void transferGuards() {
        Inventory donor = inv(10, 4);
        Inventory requester = inv(5, 1);
        donor.giveAway(2);
        requester.receive(2);
        assertThat(donor.getTotal()).isEqualTo(8);
        assertThat(donor.getAvailable()).isEqualTo(2);
        assertThat(requester.getTotal()).isEqualTo(7);
        assertThat(requester.getAvailable()).isEqualTo(3);
        assertThatThrownBy(() -> donor.giveAway(3)).isInstanceOf(ConflictException.class);
        assertThat(donor.getTotal()).isEqualTo(8);
    }

    @Test
    @DisplayName("Retry executor re-runs on lock conflicts and gives up after the limit")
    void retryExecutor() {
        TransactionRetryExecutor retry = new TransactionRetryExecutor();
        AtomicInteger calls = new AtomicInteger();
        String result = retry.execute(() -> {
            if (calls.incrementAndGet() < 3) {
                throw new CannotAcquireLockException("deadlock");
            }
            return "done";
        });
        assertThat(result).isEqualTo("done");
        assertThat(calls).hasValue(3);

        AtomicInteger always = new AtomicInteger();
        assertThatThrownBy(() -> retry.execute(() -> {
            always.incrementAndGet();
            throw new CannotAcquireLockException("deadlock");
        })).isInstanceOf(CannotAcquireLockException.class);
        assertThat(always).hasValue(4);

        // Business errors are not retried.
        AtomicInteger business = new AtomicInteger();
        assertThatThrownBy(() -> retry.execute(() -> {
            business.incrementAndGet();
            throw new ConflictException("nope");
        })).isInstanceOf(ConflictException.class);
        assertThat(business).hasValue(1);
    }
}
