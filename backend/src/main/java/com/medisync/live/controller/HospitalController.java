package com.medisync.live.controller;

import com.medisync.live.dto.ActivityDto;
import com.medisync.live.dto.HospitalDto;
import com.medisync.live.dto.StatsDto;
import com.medisync.live.service.ActivityService;
import com.medisync.live.service.HospitalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Hospitals & dashboard")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;
    private final ActivityService activityService;

    @Value("${medisync.activity.default-limit:30}")
    private int defaultActivityLimit;

    @Operation(summary = "All hospitals with the inventory of every resource type")
    @GetMapping("/hospitals")
    public List<HospitalDto> hospitals() {
        return hospitalService.listHospitals();
    }

    @Operation(summary = "One hospital with its inventory")
    @GetMapping("/hospitals/{id}")
    public HospitalDto hospital(@PathVariable Long id) {
        return hospitalService.getHospital(id);
    }

    @Operation(summary = "Dashboard summary: capacity, active admissions, waiting patients, average distance")
    @GetMapping("/stats")
    public StatsDto stats() {
        return hospitalService.stats();
    }

    @Operation(summary = "Latest activity log entries (default 30, max 200)")
    @GetMapping("/activity")
    public List<ActivityDto> activity(@RequestParam(required = false) Integer limit) {
        return activityService.latest(limit == null ? defaultActivityLimit : limit);
    }
}
