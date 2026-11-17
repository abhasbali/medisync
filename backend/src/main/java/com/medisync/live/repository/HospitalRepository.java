package com.medisync.live.repository;

import com.medisync.live.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HospitalRepository extends JpaRepository<Hospital, Long> {
    List<Hospital> findAllByOrderByIdAsc();
}
