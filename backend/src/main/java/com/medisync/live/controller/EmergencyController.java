package com.medisync.live.controller;

import com.medisync.live.dto.AllocationResultDto;
import com.medisync.live.dto.CreateEmergencyRequest;
import com.medisync.live.dto.EmergencyRequestDto;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import com.medisync.live.enums.Severity;
import com.medisync.live.service.EmergencyService;
import com.medisync.live.service.TransactionRetryExecutor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Emergency requests")
@RestController
@RequestMapping("/api/requests")
@RequiredArgsConstructor
public class EmergencyController {

    private final EmergencyService emergencyService;
    private final TransactionRetryExecutor retry;

    @Operation(summary = "List emergency requests (newest first) with optional filters")
    @GetMapping
    public List<EmergencyRequestDto> list(@RequestParam(required = false) RequestStatus status,
                                          @RequestParam(required = false) Severity severity,
                                          @RequestParam(required = false) ResourceType resourceType,
                                          @RequestParam(required = false) String search) {
        return emergencyService.list(status, severity, resourceType, search);
    }

    @Operation(summary = "Waiting requests in dispatch order (CRITICAL > SERIOUS > STABLE, then arrival)")
    @GetMapping("/queue")
    public List<EmergencyRequestDto> queue() {
        return emergencyService.queue();
    }

    @Operation(summary = "One emergency request")
    @GetMapping("/{id}")
    public EmergencyRequestDto get(@PathVariable Long id) {
        return emergencyService.get(id);
    }

    @Operation(summary = "Create a request and allocate the nearest free bed, or queue it")
    @PostMapping
    public ResponseEntity<AllocationResultDto> create(@Valid @RequestBody CreateEmergencyRequest body) {
        AllocationResultDto result = retry.execute(() -> emergencyService.create(body));
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @Operation(summary = "Discharge an allocated patient and serve the waiting queue")
    @PostMapping("/{id}/discharge")
    public EmergencyRequestDto discharge(@PathVariable Long id) {
        return retry.execute(() -> emergencyService.discharge(id));
    }

    @Operation(summary = "Cancel a pending or allocated request")
    @PostMapping("/{id}/cancel")
    public EmergencyRequestDto cancel(@PathVariable Long id) {
        return retry.execute(() -> emergencyService.cancel(id));
    }
}
