package com.medisync.live.controller;

import com.medisync.live.dto.InventoryDto;
import com.medisync.live.dto.InventoryUpdateRequest;
import com.medisync.live.service.InventoryService;
import com.medisync.live.service.TransactionRetryExecutor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Inventory")
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final TransactionRetryExecutor retry;

    @Operation(summary = "All inventory rows")
    @GetMapping
    public List<InventoryDto> all() {
        return inventoryService.listAll();
    }

    @Operation(summary = "Inventory rows of one hospital")
    @GetMapping("/hospital/{hospitalId}")
    public List<InventoryDto> byHospital(@PathVariable Long hospitalId) {
        return inventoryService.listByHospital(hospitalId);
    }

    @Operation(summary = "Update total and available units; extra free capacity is offered to the waiting queue")
    @PatchMapping("/{id}")
    public InventoryDto update(@PathVariable Long id, @Valid @RequestBody InventoryUpdateRequest body) {
        return retry.execute(() -> inventoryService.update(id, body));
    }
}
