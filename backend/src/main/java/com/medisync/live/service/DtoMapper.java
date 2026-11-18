package com.medisync.live.service;

import com.medisync.live.dto.*;
import com.medisync.live.entity.*;

/** Entity to DTO conversion. Controllers never expose JPA entities. Call inside a transaction. */
public final class DtoMapper {

    private DtoMapper() {
    }

    public static InventoryDto toDto(Inventory i, long activeAllocations) {
        return new InventoryDto(i.getId(), i.getHospital().getId(), i.getHospital().getName(), i.getResourceType(),
                i.getTotal(), i.getAvailable(), i.getOccupied(), activeAllocations, i.getUpdatedAt());
    }

    public static EmergencyRequestDto toDto(EmergencyRequest r) {
        return toDto(r, null);
    }

    public static EmergencyRequestDto toDto(EmergencyRequest r, Integer queuePosition) {
        Hospital h = r.getAllocatedHospital();
        return new EmergencyRequestDto(
                r.getId(), r.getPatientName(), r.getPatientAge(), r.getPatientCondition(), r.getSeverity(),
                r.getResourceType(), r.getLatitude().doubleValue(), r.getLongitude().doubleValue(), r.getStatus(),
                h == null ? null : h.getId(),
                h == null ? null : h.getName(),
                h == null ? null : h.getArea(),
                h == null ? null : h.getPhone(),
                r.getAllocatedDistanceKm() == null ? null : r.getAllocatedDistanceKm().doubleValue(),
                r.getCreatedAt(), r.getAllocatedAt(), r.getCompletedAt(), queuePosition);
    }

    public static TransferDto toDto(TransferRequest t) {
        return new TransferDto(t.getId(), t.getRequester().getId(), t.getRequester().getName(),
                t.getDonor().getId(), t.getDonor().getName(), t.getResourceType(), t.getQuantity(), t.getNote(),
                t.getStatus(), t.getCreatedAt(), t.getResolvedAt());
    }

    public static ActivityDto toDto(ActivityLog a) {
        return new ActivityDto(a.getId(), a.getActionType(), a.getMessage(), a.getReferenceId(), a.getActor(), a.getCreatedAt());
    }
}
