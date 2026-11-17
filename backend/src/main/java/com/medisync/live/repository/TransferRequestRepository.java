package com.medisync.live.repository;

import com.medisync.live.entity.TransferRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TransferRequestRepository extends JpaRepository<TransferRequest, Long> {

    long countByStatus(com.medisync.live.enums.TransferStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TransferRequest t join fetch t.requester join fetch t.donor where t.id = :id")
    Optional<TransferRequest> lockById(@Param("id") Long id);

    @Query("select t from TransferRequest t join fetch t.requester join fetch t.donor order by t.createdAt desc, t.id desc")
    List<TransferRequest> findAllWithHospitals();

    @Query("select t from TransferRequest t join fetch t.requester join fetch t.donor where t.id = :id")
    Optional<TransferRequest> findWithHospitals(@Param("id") Long id);
}
