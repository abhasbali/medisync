package com.medisync.live.service;

import com.medisync.live.entity.EmergencyRequest;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.repository.EmergencyRequestRepository;
import com.medisync.live.websocket.ChangePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Nearest-bed allocation and severity-based queue dispatch.
 * <p>
 * Concurrency model: every caller first locks all inventory rows of the resource type with
 * {@code SELECT ... FOR UPDATE} (ordered by id) and passes those locked rows in. While the locks are
 * held no other transaction can change availability of that type, so the guarded decrement in
 * {@link Inventory#tryReserveOne()} can never hand the same unit to two patients. Pending requests
 * are locked only after the inventory rows, which keeps one global lock order.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AllocationEngine {

    /** CRITICAL, then SERIOUS, then STABLE; first-come-first-served within a severity. */
    public static final Comparator<EmergencyRequest> PRIORITY = Comparator
            .comparingInt((EmergencyRequest r) -> r.getSeverity().priority())
            .thenComparing(EmergencyRequest::getCreatedAt)
            .thenComparing(EmergencyRequest::getId);

    private final EmergencyRequestRepository requestRepository;
    private final ActivityService activityService;
    private final ChangePublisher changes;

    /** A hospital inventory row with free capacity and its distance from the patient. */
    public record Candidate(Inventory inventory, double distanceKm) {
    }

    /** Eligible rows (matching type, at least one free unit) sorted nearest first, ties broken by id. */
    public static List<Candidate> rankCandidates(List<Inventory> rows, ResourceType type, double lat, double lng) {
        List<Candidate> list = new ArrayList<>();
        for (Inventory inv : rows) {
            if (inv.getResourceType() == type && inv.getAvailable() > 0) {
                double d = GeoUtils.haversineKm(lat, lng,
                        inv.getHospital().getLatitude().doubleValue(), inv.getHospital().getLongitude().doubleValue());
                list.add(new Candidate(inv, d));
            }
        }
        list.sort(Comparator.comparingDouble(Candidate::distanceKm).thenComparing(c -> c.inventory().getId()));
        return list;
    }

    /**
     * Try to reserve the nearest free unit for a PENDING request. Returns true when allocated.
     * If the nearest row turns out to have no unit left, the next eligible hospital is tried.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean tryAllocate(EmergencyRequest request, List<Inventory> lockedRows) {
        if (request.getStatus() != RequestStatus.PENDING) {
            return false;
        }
        List<Candidate> candidates = rankCandidates(lockedRows, request.getResourceType(),
                request.getLatitude().doubleValue(), request.getLongitude().doubleValue());
        for (Candidate c : candidates) {
            Inventory inv = c.inventory();
            if (!inv.tryReserveOne()) {
                continue;
            }
            request.setStatus(RequestStatus.ALLOCATED);
            request.setAllocatedHospital(inv.getHospital());
            request.setAllocatedDistanceKm(BigDecimal.valueOf(c.distanceKm()).setScale(2, RoundingMode.HALF_UP));
            request.setAllocatedAt(Instant.now());
            activityService.record(ActivityType.ALLOCATED, String.format("%s (%s) -> %s bed at %s, %.1f km away",
                    request.getPatientName(), request.getSeverity(), request.getResourceType(),
                    inv.getHospital().getName(), c.distanceKm()), request.getId());
            changes.request("ALLOCATED", request.getId());
            return true;
        }
        return false;
    }

    /**
     * Serve the waiting queue of one resource type in priority order using the locked inventory rows.
     * A request that cannot be served stays PENDING and does not block the others.
     *
     * @return the requests that were allocated by this dispatch run
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<EmergencyRequest> dispatchQueue(ResourceType type, List<Inventory> lockedRows) {
        List<EmergencyRequest> pending = new ArrayList<>(requestRepository.lockPendingByType(type));
        pending.sort(PRIORITY);
        List<EmergencyRequest> allocated = new ArrayList<>();
        for (EmergencyRequest r : pending) {
            if (lockedRows.stream().noneMatch(i -> i.getAvailable() > 0)) {
                break; // no capacity left for this type; everyone else keeps waiting
            }
            if (tryAllocate(r, lockedRows)) {
                allocated.add(r);
            }
        }
        if (!allocated.isEmpty()) {
            log.info("Queue dispatch for {} allocated {} waiting request(s)", type, allocated.size());
        }
        return allocated;
    }
}
