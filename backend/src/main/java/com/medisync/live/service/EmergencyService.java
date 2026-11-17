package com.medisync.live.service;

import com.medisync.live.dto.AllocationResultDto;
import com.medisync.live.dto.CreateEmergencyRequest;
import com.medisync.live.dto.EmergencyRequestDto;
import com.medisync.live.entity.EmergencyRequest;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.EmergencyRequestRepository;
import com.medisync.live.repository.InventoryRepository;
import com.medisync.live.websocket.ChangePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EmergencyService {

    public static final String QUEUED_MESSAGE =
            "Currently no suitable bed is available. The request has been added to the priority queue.";

    private final EmergencyRequestRepository requestRepository;
    private final InventoryRepository inventoryRepository;
    private final AllocationEngine engine;
    private final ActivityService activityService;
    private final ChangePublisher changes;

    /**
     * Save the request and try to allocate the nearest free unit in one transaction. The new request
     * joins the queue of its type and the queue is dispatched in priority order, so a newcomer never
     * overtakes a more urgent patient who is already waiting.
     */
    @Transactional
    public AllocationResultDto create(CreateEmergencyRequest in) {
        List<Inventory> locked = inventoryRepository.lockByType(in.resourceType());

        EmergencyRequest r = new EmergencyRequest();
        r.setPatientName(in.patientName().trim());
        r.setPatientAge(in.patientAge());
        r.setPatientCondition(in.patientCondition().trim());
        r.setSeverity(in.severity());
        r.setResourceType(in.resourceType());
        r.setLatitude(BigDecimal.valueOf(in.latitude()).setScale(6, RoundingMode.HALF_UP));
        r.setLongitude(BigDecimal.valueOf(in.longitude()).setScale(6, RoundingMode.HALF_UP));
        r.setStatus(RequestStatus.PENDING);
        requestRepository.saveAndFlush(r);

        activityService.record(ActivityType.REQUEST_CREATED, String.format("New %s request for %s bed: %s, %d (%s)",
                r.getSeverity(), r.getResourceType(), r.getPatientName(), r.getPatientAge(), r.getPatientCondition()), r.getId());
        changes.request("REQUEST_CREATED", r.getId());

        engine.dispatchQueue(r.getResourceType(), locked);

        if (r.getStatus() == RequestStatus.ALLOCATED) {
            String msg = String.format("%s bed reserved at %s (%.1f km away).", r.getResourceType(),
                    r.getAllocatedHospital().getName(), r.getAllocatedDistanceKm().doubleValue());
            return new AllocationResultDto(true, msg, DtoMapper.toDto(r));
        }
        activityService.record(ActivityType.QUEUED, String.format("%s (%s) queued: no free %s bed",
                r.getPatientName(), r.getSeverity(), r.getResourceType()), r.getId());
        changes.request("QUEUED", r.getId());
        return new AllocationResultDto(false, QUEUED_MESSAGE, DtoMapper.toDto(r, queuePositionOf(r)));
    }

    /** Discharge an ALLOCATED patient: free the unit exactly once and serve the waiting queue. */
    @Transactional
    public EmergencyRequestDto discharge(Long id) {
        return close(id, true);
    }

    /** Cancel a PENDING request (no inventory change) or an ALLOCATED one (unit released, queue served). */
    @Transactional
    public EmergencyRequestDto cancel(Long id) {
        return close(id, false);
    }

    private EmergencyRequestDto close(Long id, boolean discharge) {
        ResourceType type = requestRepository.findResourceTypeById(id)
                .orElseThrow(() -> NotFoundException.of("Emergency request", id));
        // Lock order: inventory rows of the type first, then the request row.
        List<Inventory> locked = inventoryRepository.lockByType(type);
        EmergencyRequest r = requestRepository.lockById(id)
                .orElseThrow(() -> NotFoundException.of("Emergency request", id));

        RequestStatus current = r.getStatus();
        if (discharge && current != RequestStatus.ALLOCATED) {
            throw new ConflictException("Only ALLOCATED requests can be discharged; request #" + id + " is " + current);
        }
        if (!discharge && current != RequestStatus.PENDING && current != RequestStatus.ALLOCATED) {
            throw new ConflictException("Only PENDING or ALLOCATED requests can be cancelled; request #" + id + " is " + current);
        }

        boolean releasesUnit = current == RequestStatus.ALLOCATED;
        String hospitalName = null;
        if (releasesUnit) {
            Long hospitalId = r.getAllocatedHospital().getId();
            Inventory inv = locked.stream()
                    .filter(i -> i.getHospital().getId().equals(hospitalId))
                    .findFirst()
                    .orElseThrow(() -> new ConflictException("Inventory record for the allocated hospital no longer exists"));
            inv.releaseOne();
            hospitalName = inv.getHospital().getName();
        }

        r.setStatus(discharge ? RequestStatus.DISCHARGED : RequestStatus.CANCELLED);
        r.setCompletedAt(Instant.now());

        String msg;
        if (discharge) {
            msg = String.format("%s discharged from %s; %s bed released", r.getPatientName(), hospitalName, type);
        } else if (releasesUnit) {
            msg = String.format("Request #%d for %s cancelled; %s bed at %s released", id, r.getPatientName(), type, hospitalName);
        } else {
            msg = String.format("Waiting request #%d for %s cancelled", id, r.getPatientName());
        }
        activityService.record(discharge ? ActivityType.DISCHARGED : ActivityType.CANCELLED, msg, id);
        changes.request(discharge ? "DISCHARGED" : "CANCELLED", id);

        if (releasesUnit) {
            engine.dispatchQueue(type, locked);
        }
        return DtoMapper.toDto(r);
    }

    @Transactional(readOnly = true)
    public List<EmergencyRequestDto> list(RequestStatus status, Severity severity, ResourceType type, String search) {
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Map<Long, Integer> positions = queuePositions();
        return requestRepository.findAllWithHospital().stream()
                .filter(r -> status == null || r.getStatus() == status)
                .filter(r -> severity == null || r.getSeverity() == severity)
                .filter(r -> type == null || r.getResourceType() == type)
                .filter(r -> q.isEmpty()
                        || r.getPatientName().toLowerCase(Locale.ROOT).contains(q)
                        || r.getPatientCondition().toLowerCase(Locale.ROOT).contains(q)
                        || String.valueOf(r.getId()).equals(q)
                        || (r.getAllocatedHospital() != null
                        && r.getAllocatedHospital().getName().toLowerCase(Locale.ROOT).contains(q)))
                .map(r -> DtoMapper.toDto(r, positions.get(r.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public EmergencyRequestDto get(Long id) {
        EmergencyRequest r = requestRepository.findWithHospital(id)
                .orElseThrow(() -> NotFoundException.of("Emergency request", id));
        return DtoMapper.toDto(r, queuePositions().get(id));
    }

    /** All waiting requests in dispatch order; queuePosition is the 1-based position within the request's resource queue. */
    @Transactional(readOnly = true)
    public List<EmergencyRequestDto> queue() {
        List<EmergencyRequest> pending = new ArrayList<>(requestRepository.findByStatus(RequestStatus.PENDING));
        pending.sort(AllocationEngine.PRIORITY);
        Map<ResourceType, Integer> counters = new EnumMap<>(ResourceType.class);
        List<EmergencyRequestDto> out = new ArrayList<>();
        for (EmergencyRequest r : pending) {
            int pos = counters.merge(r.getResourceType(), 1, Integer::sum);
            out.add(DtoMapper.toDto(r, pos));
        }
        return out;
    }

    private Map<Long, Integer> queuePositions() {
        Map<Long, Integer> map = new HashMap<>();
        for (EmergencyRequestDto d : queue()) {
            map.put(d.id(), d.queuePosition());
        }
        return map;
    }

    private Integer queuePositionOf(EmergencyRequest r) {
        return queuePositions().get(r.getId());
    }
}
