package com.medisync.live.service;

import com.medisync.live.dto.CreateTransferRequest;
import com.medisync.live.dto.TransferDto;
import com.medisync.live.entity.Hospital;
import com.medisync.live.entity.Inventory;
import com.medisync.live.entity.TransferRequest;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.TransferStatus;
import com.medisync.live.exception.BadRequestException;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.HospitalRepository;
import com.medisync.live.repository.InventoryRepository;
import com.medisync.live.repository.TransferRequestRepository;
import com.medisync.live.websocket.ChangePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransferRequestRepository transferRepository;
    private final HospitalRepository hospitalRepository;
    private final InventoryRepository inventoryRepository;
    private final AllocationEngine engine;
    private final ActivityService activityService;
    private final ChangePublisher changes;

    @Transactional(readOnly = true)
    public List<TransferDto> list() {
        return transferRepository.findAllWithHospitals().stream().map(DtoMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TransferDto get(Long id) {
        return transferRepository.findWithHospitals(id).map(DtoMapper::toDto)
                .orElseThrow(() -> NotFoundException.of("Transfer request", id));
    }

    @Transactional
    public TransferDto create(CreateTransferRequest in) {
        if (in.requesterHospitalId().equals(in.donorHospitalId())) {
            throw new BadRequestException("Requesting hospital and donor hospital must be different");
        }
        Hospital requester = hospitalRepository.findById(in.requesterHospitalId())
                .orElseThrow(() -> NotFoundException.of("Hospital", in.requesterHospitalId()));
        Hospital donor = hospitalRepository.findById(in.donorHospitalId())
                .orElseThrow(() -> NotFoundException.of("Hospital", in.donorHospitalId()));

        TransferRequest t = new TransferRequest();
        t.setRequester(requester);
        t.setDonor(donor);
        t.setResourceType(in.resourceType());
        t.setQuantity(in.quantity());
        String note = in.note() == null ? null : in.note().trim();
        t.setNote(note == null || note.isEmpty() ? null : note);
        t.setStatus(TransferStatus.PENDING);
        transferRepository.saveAndFlush(t);

        activityService.record(ActivityType.TRANSFER_REQUESTED, String.format("%s asked %s for %d %s",
                requester.getName(), donor.getName(), t.getQuantity(), t.getResourceType()), t.getId());
        changes.transfer("TRANSFER_REQUESTED", t.getId());
        return DtoMapper.toDto(t);
    }

    /**
     * Approve atomically: lock the transfer, lock the inventory rows of the type (id order), check the
     * donor stock, move the units, mark APPROVED and serve the waiting queue with the new capacity.
     * Any failure rolls back everything, leaving the transfer PENDING and all counts unchanged.
     */
    @Transactional
    public TransferDto approve(Long id) {
        TransferRequest t = lockPending(id);
        ResourceType type = t.getResourceType();
        Long donorId = t.getDonor().getId();
        Long requesterId = t.getRequester().getId();

        List<Inventory> locked = inventoryRepository.lockByType(type);
        Inventory donorInv = find(locked, donorId)
                .orElseThrow(() -> new ConflictException(t.getDonor().getName() + " has no " + type + " inventory to share"));
        if (donorInv.getAvailable() < t.getQuantity()) {
            throw new ConflictException(String.format(
                    "Donor does not have enough available units: %s has %d free %s unit(s), %d requested",
                    t.getDonor().getName(), donorInv.getAvailable(), type, t.getQuantity()));
        }

        Optional<Inventory> requesterRow = find(locked, requesterId);
        if (requesterRow.isEmpty()) {
            // The requester has never held this type. INSERT IGNORE honours the unique key, then re-lock.
            inventoryRepository.insertEmptyIfMissing(requesterId, type.name());
            locked = inventoryRepository.lockByType(type);
            requesterRow = find(locked, requesterId);
        }
        Inventory requesterInv = requesterRow
                .orElseThrow(() -> new IllegalStateException("Requester inventory row could not be created"));

        donorInv.giveAway(t.getQuantity());
        requesterInv.receive(t.getQuantity());
        t.setStatus(TransferStatus.APPROVED);
        t.setResolvedAt(Instant.now());

        activityService.record(ActivityType.TRANSFER_APPROVED, String.format("%s approved %d %s for %s",
                t.getDonor().getName(), t.getQuantity(), type, t.getRequester().getName()), t.getId());
        changes.transfer("TRANSFER_APPROVED", t.getId());

        engine.dispatchQueue(type, locked);
        return DtoMapper.toDto(t);
    }

    /** Reject: only the status changes; inventory is untouched. */
    @Transactional
    public TransferDto reject(Long id) {
        TransferRequest t = lockPending(id);
        t.setStatus(TransferStatus.REJECTED);
        t.setResolvedAt(Instant.now());
        activityService.record(ActivityType.TRANSFER_REJECTED, String.format("%s rejected %d %s for %s",
                t.getDonor().getName(), t.getQuantity(), t.getResourceType(), t.getRequester().getName()), t.getId());
        changes.transfer("TRANSFER_REJECTED", t.getId());
        return DtoMapper.toDto(t);
    }

    private TransferRequest lockPending(Long id) {
        TransferRequest t = transferRepository.lockById(id)
                .orElseThrow(() -> NotFoundException.of("Transfer request", id));
        if (t.getStatus() != TransferStatus.PENDING) {
            throw new ConflictException("Transfer request #" + id + " has already been " + t.getStatus());
        }
        return t;
    }

    private static Optional<Inventory> find(List<Inventory> rows, Long hospitalId) {
        return rows.stream().filter(i -> i.getHospital().getId().equals(hospitalId)).findFirst();
    }
}
