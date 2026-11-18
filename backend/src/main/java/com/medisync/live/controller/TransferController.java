package com.medisync.live.controller;

import com.medisync.live.dto.CreateTransferRequest;
import com.medisync.live.dto.TransferDto;
import com.medisync.live.service.TransactionRetryExecutor;
import com.medisync.live.service.TransferService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Resource sharing")
@RestController
@RequestMapping("/api/transfers")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;
    private final TransactionRetryExecutor retry;
    private final com.medisync.live.security.AccessGuard guard;

    @Operation(summary = "All transfer requests (newest first)")
    @GetMapping
    public List<TransferDto> list() {
        return transferService.list();
    }

    @Operation(summary = "One transfer request")
    @GetMapping("/{id}")
    public TransferDto get(@PathVariable Long id) {
        return transferService.get(id);
    }

    @Operation(summary = "Create a PENDING transfer request")
    @PostMapping
    public ResponseEntity<TransferDto> create(@Valid @RequestBody CreateTransferRequest body) {
        guard.requireHospital(body.requesterHospitalId(), "request transfers");
        return ResponseEntity.status(HttpStatus.CREATED).body(retry.execute(() -> transferService.create(body)));
    }

    @Operation(summary = "Donor approves: capacity moves atomically, waiting patients are served")
    @PostMapping("/{id}/approve")
    public TransferDto approve(@PathVariable Long id) {
        guard.requireDonorAccess(id);
        return retry.execute(() -> transferService.approve(id));
    }

    @Operation(summary = "Donor rejects: only the status changes")
    @PostMapping("/{id}/reject")
    public TransferDto reject(@PathVariable Long id) {
        guard.requireDonorAccess(id);
        return retry.execute(() -> transferService.reject(id));
    }
}
