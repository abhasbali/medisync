package com.medisync.live.repository;

import com.medisync.live.entity.EmergencyRequest;
import com.medisync.live.enums.RequestStatus;
import com.medisync.live.enums.ResourceType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EmergencyRequestRepository extends JpaRepository<EmergencyRequest, Long> {

    /**
     * Scalar read used before locking. Loading the entity itself here would put a stale snapshot in the
     * persistence context that a later locking query would not refresh.
     */
    @Query("select r.resourceType from EmergencyRequest r where r.id = :id")
    Optional<ResourceType> findResourceTypeById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from EmergencyRequest r left join fetch r.allocatedHospital where r.id = :id")
    Optional<EmergencyRequest> lockById(@Param("id") Long id);

    /** Locks the pending requests of one type (in id order). The caller sorts them by priority. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from EmergencyRequest r where r.status = com.medisync.live.enums.RequestStatus.PENDING "
            + "and r.resourceType = :type order by r.id")
    List<EmergencyRequest> lockPendingByType(@Param("type") ResourceType type);

    @Query("select r from EmergencyRequest r left join fetch r.allocatedHospital order by r.createdAt desc, r.id desc")
    List<EmergencyRequest> findAllWithHospital();

    @Query("select r from EmergencyRequest r left join fetch r.allocatedHospital where r.id = :id")
    Optional<EmergencyRequest> findWithHospital(@Param("id") Long id);

    List<EmergencyRequest> findByStatus(RequestStatus status);

    long countByStatus(RequestStatus status);

    @Query("select count(r) from EmergencyRequest r where r.status = com.medisync.live.enums.RequestStatus.ALLOCATED "
            + "and r.allocatedHospital.id = :hospitalId and r.resourceType = :type")
    long countActiveAllocations(@Param("hospitalId") Long hospitalId, @Param("type") ResourceType type);

    /** Rows of [hospitalId, resourceType, count] for every hospital/type with active allocations. */
    @Query("select r.allocatedHospital.id, r.resourceType, count(r) from EmergencyRequest r "
            + "where r.status = com.medisync.live.enums.RequestStatus.ALLOCATED "
            + "group by r.allocatedHospital.id, r.resourceType")
    List<Object[]> countActiveAllocationsGrouped();

    @Query("select avg(r.allocatedDistanceKm) from EmergencyRequest r where r.allocatedDistanceKm is not null")
    Double averageAllocationDistance();
}
