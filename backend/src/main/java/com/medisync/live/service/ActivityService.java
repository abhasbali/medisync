package com.medisync.live.service;

import com.medisync.live.dto.ActivityDto;
import com.medisync.live.entity.ActivityLog;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityLogRepository repository;

    /** Writes an audit entry as part of the caller's transaction, so it rolls back with it. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(ActivityType type, String message, Long referenceId) {
        repository.save(new ActivityLog(type, message, referenceId));
        log.info("[{}] {}", type, message);
    }

    @Transactional(readOnly = true)
    public List<ActivityDto> latest(int limit) {
        int size = Math.max(1, Math.min(limit, 200));
        return repository.findLatest(PageRequest.of(0, size)).stream().map(DtoMapper::toDto).toList();
    }
}
