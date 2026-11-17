package com.medisync.live.service;

import com.medisync.live.dto.InventoryDto;
import com.medisync.live.dto.InventoryUpdateRequest;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.exception.BadRequestException;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.EmergencyRequestRepository;
import com.medisync.live.repository.HospitalRepository;
import com.medisync.live.repository.InventoryRepository;
import com.medisync.live.websocket.ChangePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final HospitalRepository hospitalRepository;
    private final EmergencyRequestRepository requestRepository;
    private final AllocationEngine engine;
    private final ActivityService activityService;
    private final ChangePublisher changes;

    @Transactional(readOnly = true)
    public List<InventoryDto> listAll() {
        Map<String, Long> active = activeAllocationCounts();
        return inventoryRepository.findAllWithHospital().stream()
                .map(i -> DtoMapper.toDto(i, active.getOrDefault(key(i.getHospital().getId(), i.getResourceType()), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryDto> listByHospital(Long hospitalId) {
        if (!hospitalRepository.existsById(hospitalId)) {
            throw NotFoundException.of("Hospital", hospitalId);
        }
        Map<String, Long> active = activeAllocationCounts();
        return inventoryRepository.findByHospitalId(hospitalId).stream()
                .map(i -> DtoMapper.toDto(i, active.getOrDefault(key(hospitalId, i.getResourceType()), 0L)))
                .toList();
    }

    /**
     * Update total and available counts of one inventory row.
     * Rules: available <= total, and the occupied units (total - available) can never drop below the
     * number of patients the system has currently allocated to this row, so an edit cannot silently
     * invalidate an active reservation. Added free capacity is offered to the waiting queue at once.
     */
    @Transactional
    public InventoryDto update(Long id, InventoryUpdateRequest in) {
        int total = in.total();
        int available = in.available();
        if (available > total) {
            throw new BadRequestException("Available units (" + available + ") cannot exceed total units (" + total + ")");
        }
        ResourceType type = inventoryRepository.findResourceTypeById(id)
                .orElseThrow(() -> NotFoundException.of("Inventory record", id));
        List<Inventory> locked = inventoryRepository.lockByType(type);
        Inventory inv = locked.stream().filter(i -> i.getId().equals(id)).findFirst()
                .orElseThrow(() -> NotFoundException.of("Inventory record", id));

        long active = requestRepository.countActiveAllocations(inv.getHospital().getId(), type);
        if (total - available < active) {
            throw new ConflictException(String.format(
                    "%d patient(s) are currently allocated a %s bed at %s, so at least %d unit(s) must remain occupied "
                            + "(total - available >= %d)", active, type, inv.getHospital().getName(), active, active));
        }

        int oldTotal = inv.getTotal();
        int oldAvailable = inv.getAvailable();
        if (oldTotal != total || oldAvailable != available) {
            inv.setTotal(total);
            inv.setAvailable(available);
            inv.touch();
            activityService.record(ActivityType.INVENTORY_UPDATED, String.format(
                    "%s updated %s: total %d -> %d, available %d -> %d", inv.getHospital().getName(), type,
                    oldTotal, total, oldAvailable, available), inv.getId());
            changes.inventory("INVENTORY_UPDATED", inv.getId());
            if (available > oldAvailable) {
                engine.dispatchQueue(type, locked);
            }
        }
        long activeNow = requestRepository.countActiveAllocations(inv.getHospital().getId(), type);
        return DtoMapper.toDto(inv, activeNow);
    }

    private Map<String, Long> activeAllocationCounts() {
        Map<String, Long> map = new HashMap<>();
        for (Object[] row : requestRepository.countActiveAllocationsGrouped()) {
            map.put(key((Long) row[0], (ResourceType) row[1]), (Long) row[2]);
        }
        return map;
    }

    static String key(Long hospitalId, ResourceType type) {
        return hospitalId + ":" + type;
    }
}
