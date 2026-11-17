package com.medisync.live.service;

import com.medisync.live.dto.HospitalDto;
import com.medisync.live.dto.InventoryDto;
import com.medisync.live.dto.StatsDto;
import com.medisync.live.entity.Hospital;
import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.TransferStatus;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.EmergencyRequestRepository;
import com.medisync.live.repository.HospitalRepository;
import com.medisync.live.repository.InventoryRepository;
import com.medisync.live.repository.TransferRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final InventoryRepository inventoryRepository;
    private final EmergencyRequestRepository requestRepository;
    private final TransferRequestRepository transferRepository;
    private final InventoryService inventoryService;

    /** Every hospital with its inventory rows (in resource display order). */
    @Transactional(readOnly = true)
    public List<HospitalDto> listHospitals() {
        Map<Long, List<InventoryDto>> byHospital = new HashMap<>();
        for (InventoryDto dto : inventoryService.listAll()) {
            byHospital.computeIfAbsent(dto.hospitalId(), k -> new ArrayList<>()).add(dto);
        }
        return hospitalRepository.findAllByOrderByIdAsc().stream()
                .map(h -> toDto(h, byHospital.getOrDefault(h.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public HospitalDto getHospital(Long id) {
        Hospital h = hospitalRepository.findById(id).orElseThrow(() -> NotFoundException.of("Hospital", id));
        return toDto(h, inventoryService.listByHospital(id));
    }

    @Transactional(readOnly = true)
    public StatsDto stats() {
        Map<ResourceType, long[]> sums = new EnumMap<>(ResourceType.class);
        for (ResourceType t : ResourceType.values()) {
            sums.put(t, new long[2]);
        }
        long total = 0;
        long available = 0;
        for (Inventory i : inventoryRepository.findAllWithHospital()) {
            long[] s = sums.get(i.getResourceType());
            s[0] += i.getTotal();
            s[1] += i.getAvailable();
            total += i.getTotal();
            available += i.getAvailable();
        }
        List<StatsDto.ResourceSummary> byResource = sums.entrySet().stream()
                .map(e -> new StatsDto.ResourceSummary(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();
        Double avg = requestRepository.averageAllocationDistance();
        long pendingTransfers = transferRepository.countByStatus(TransferStatus.PENDING);
        return new StatsDto(total, available,
                requestRepository.countByStatus(RequestStatus.ALLOCATED),
                requestRepository.countByStatus(RequestStatus.PENDING),
                avg == null ? null : GeoUtils.round2(avg),
                hospitalRepository.count(),
                pendingTransfers,
                byResource);
    }

    private static HospitalDto toDto(Hospital h, List<InventoryDto> inventory) {
        List<InventoryDto> sorted = inventory.stream()
                .sorted(Comparator.comparing(InventoryDto::resourceType))
                .toList();
        int total = sorted.stream().mapToInt(InventoryDto::total).sum();
        int available = sorted.stream().mapToInt(InventoryDto::available).sum();
        return new HospitalDto(h.getId(), h.getName(), h.getArea(), h.getPhone(),
                h.getLatitude().doubleValue(), h.getLongitude().doubleValue(), h.getCreatedAt(),
                total, available, sorted);
    }
}
