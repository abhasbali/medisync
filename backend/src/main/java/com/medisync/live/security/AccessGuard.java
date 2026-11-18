package com.medisync.live.security;

import com.medisync.live.enums.Role;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.InventoryRepository;
import com.medisync.live.repository.TransferRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Hospital-level authorisation: HOSPITAL_STAFF may only act on their own hospital. ADMIN may act anywhere. */
@Component
@RequiredArgsConstructor
public class AccessGuard {

    private final InventoryRepository inventory;
    private final TransferRequestRepository transfers;

    public void requireHospital(Long hospitalId, String what) {
        if (CurrentUser.hasRole(Role.ADMIN.name())) {
            return;
        }
        Long own = CurrentUser.get().map(AuthUser::hospitalId).orElse(null);
        if (own == null || !own.equals(hospitalId)) {
            throw new AccessDeniedException("You can only " + what + " for your own hospital");
        }
    }

    @Transactional(readOnly = true)
    public void requireInventoryAccess(Long inventoryId) {
        Long hospitalId = inventory.findWithHospital(inventoryId)
                .orElseThrow(() -> new NotFoundException("Inventory row " + inventoryId + " not found"))
                .getHospital().getId();
        requireHospital(hospitalId, "edit inventory");
    }

    @Transactional(readOnly = true)
    public void requireDonorAccess(Long transferId) {
        Long donorId = transfers.findWithHospitals(transferId)
                .orElseThrow(() -> new NotFoundException("Transfer request " + transferId + " not found"))
                .getDonor().getId();
        requireHospital(donorId, "approve or reject transfers");
    }
}
